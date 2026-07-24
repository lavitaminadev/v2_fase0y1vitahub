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

  async stats(): Promise<{ pending: number; retry: number; failed: number; processed: number; total: number }> {
    const [pending, retry, failed, processed, total] = await Promise.all([
      this.outbox.count({ where: { status: 'pending' } }),
      this.outbox.count({ where: { status: 'retry' } }),
      this.outbox.count({ where: { status: 'failed' } }),
      this.outbox.count({ where: { status: 'processed' } }),
      this.outbox.count(),
    ]);
    return { pending, retry, failed, processed, total };
  }

  async processPending(limit = 25): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    const items = await this.outbox.find({
      where: [
        { status: In(['pending', 'retry']), nextAttemptAt: IsNull() },
        { status: In(['pending', 'retry']), nextAttemptAt: LessThanOrEqual(now) },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
      lock: { mode: 'pessimistic_write' },
    });

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
