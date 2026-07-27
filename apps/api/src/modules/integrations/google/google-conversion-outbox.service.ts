import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { GoogleConversionOutbox } from './google-conversion-outbox.entity';
import { GoogleClickConversion, GoogleConversionsService } from './google-conversions.service';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationProvider } from '../integration-provider.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';
import { GoogleOAuthService } from './google-oauth.service';

/** Config de Google Ads resuelta para un cliente y un tipo de evento. */
export interface ResolvedAdsConversionConfig {
  customerId: string;
  conversionAction: string;
}

/** Tiempo tras el cual un evento tomado se considera abandonado y vuelve a la cola. */
const CLAIM_TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class GoogleConversionOutboxService {
  private readonly logger = new Logger(GoogleConversionOutboxService.name);

  constructor(
    @InjectRepository(GoogleConversionOutbox) private readonly outbox: Repository<GoogleConversionOutbox>,
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    private readonly conversions: GoogleConversionsService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  /**
   * Resuelve la cuenta de Google Ads del cliente y la acción de conversión
   * configurada para ese tipo de evento.
   *
   * La configuración vive en `IntegrationAccount.metadata.conversionActions`,
   * un mapa `{ [eventKey]: conversionActionId }`. Devuelve null si el cliente
   * no tiene Ads conectado o no configuró la acción, para que el llamador
   * simplemente omita el envío en vez de fallar la reserva.
   */
  async resolveConfig(organizationId: string, clientId: string, eventKey: string): Promise<ResolvedAdsConversionConfig | null> {
    const integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) return null;

    const accounts = await this.accounts.find({
      where: { integrationId: integration.id, accountType: IntegrationAccountType.AD_ACCOUNT },
    });
    const account = accounts.find((item) => item.metadata?.clientId === clientId) ?? accounts[0];
    if (!account) return null;

    const actionId = account.metadata?.conversionActions?.[eventKey];
    if (!actionId) return null;

    const customerId = account.externalId.replace(/\D/g, '');
    return {
      customerId,
      conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
    };
  }

  async enqueue(
    organizationId: string,
    config: ResolvedAdsConversionConfig,
    eventId: string,
    conversion: Omit<GoogleClickConversion, 'conversionAction'>,
  ): Promise<GoogleConversionOutbox> {
    if (!eventId) throw new Error('A stable eventId is required for Google Ads conversions');
    const existing = await this.outbox.findOne({ where: { organizationId, eventId } });
    if (existing) return existing;
    return this.outbox.save(this.outbox.create({
      organizationId,
      eventId,
      customerId: config.customerId,
      conversionAction: config.conversionAction,
      conversionData: { ...conversion, conversionDateTime: conversion.conversionDateTime.toISOString() },
    }));
  }

  /**
   * Conteo de conversiones por estado de la cola.
   *
   * `processing` corresponde a las reservadas por una ejecución en curso; un valor que no
   * baja entre consultas indica lotes que no están completando el envío.
   */
  async stats(): Promise<{ pending: number; retry: number; processing: number; failed: number; processed: number; total: number }> {
    const countBy = (status?: string) => this.outbox.count({ where: status ? { status } : {} });
    const [pending, retry, processing, failed, processed, total] = await Promise.all([
      countBy('pending'),
      countBy('retry'),
      countBy('processing'),
      countBy('failed'),
      countBy('processed'),
      countBy(),
    ]);
    return { pending, retry, processing, failed, processed, total };
  }

  /**
   * Reserva un lote de conversiones marcándolas como `processing`.
   *
   * La reserva ocurre en una transacción corta porque el bloqueo pesimista de TypeORM
   * requiere una transacción abierta, y la subida a Google Ads se hace fuera de ella para
   * no mantener filas bloqueadas durante llamadas HTTP.
   *
   * @param limit - Máximo de conversiones a reservar.
   * @returns Las conversiones reservadas, incluidas las que quedaron abandonadas por una
   *   ejecución previa que no terminó.
   */
  private async claimBatch(limit: number): Promise<GoogleConversionOutbox[]> {
    const now = new Date();
    return this.outbox.manager.transaction(async (manager) => {
      const repository = manager.getRepository(GoogleConversionOutbox);
      // Libera las conversiones abandonadas por una ejecución previa.
      await repository.createQueryBuilder()
        .update()
        .set({ status: 'retry' })
        .where('status = :status AND updated_at <= :staleBefore', { status: 'processing', staleBefore: new Date(now.getTime() - CLAIM_TIMEOUT_MS) })
        .execute();
      const items = await repository.find({
        where: [
          { status: In(['pending', 'retry']), nextAttemptAt: IsNull() },
          { status: In(['pending', 'retry']), nextAttemptAt: LessThanOrEqual(now) },
        ],
        order: { createdAt: 'ASC' },
        take: limit,
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length === 0) return [];
      await repository.update(items.map((item) => item.id), { status: 'processing' });
      return items;
    });
  }

  async processPending(limit = 25): Promise<{ processed: number; failed: number }> {
    const items = await this.claimBatch(limit);

    let processed = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const token = await this.resolveAccessToken(item.organizationId);
        if (!token) throw new Error('Google integration is not connected');
        const data = item.conversionData as Record<string, any>;
        await this.conversions.uploadClickConversions(item.customerId, token, [{
          ...data,
          conversionAction: item.conversionAction,
          conversionDateTime: new Date(data.conversionDateTime),
        } as GoogleClickConversion]);
        item.status = 'processed';
        item.processedAt = new Date();
        item.lastError = undefined;
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Google Ads error';
        // Un payload malformado o una acción de conversión inexistente no se
        // arreglan reintentando; un 429 o un 5xx sí.
        const isNonRetryable = /INVALID_ARGUMENT|NOT_FOUND|PERMISSION_DENIED|no se requiere|Se requiere gclid/i.test(message);
        const isExpiredToken = /expired|invalid.*token|unauthorized|UNAUTHENTICATED/i.test(message);

        item.attempts += 1;
        if (isNonRetryable || isExpiredToken || item.attempts >= 8) {
          item.status = 'failed';
          item.nextAttemptAt = undefined;
        } else {
          item.status = 'retry';
          item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
        }
        item.lastError = isExpiredToken ? `[TOKEN] ${message}` : message;
        failed += 1;
        this.logger.warn(`Google Ads outbox ${item.id} failed${isNonRetryable || isExpiredToken ? ' (non-retryable)' : ''} (attempt ${item.attempts}): ${item.lastError}`);
      }
      await this.outbox.save(item);
    }
    return { processed, failed };
  }

  async cleanup(olderThanDays = 7): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
    const result = await this.outbox.delete({ status: 'processed', processedAt: LessThanOrEqual(cutoff) });
    const failedResult = await this.outbox.delete({ status: 'failed', createdAt: LessThanOrEqual(cutoff) });
    return { deleted: (result.affected ?? 0) + (failedResult.affected ?? 0) };
  }

  /** Obtiene un access token válido, refrescándolo si está por expirar. */
  private async resolveAccessToken(organizationId: string): Promise<string | undefined> {
    let integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) return undefined;

    const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
      integration = await this.oauth.refreshIntegration(integration.id, organizationId);
    }
    return revealSecret(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
  }
}
