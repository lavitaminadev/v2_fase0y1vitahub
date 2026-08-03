import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';
import { ListMetaEventsDto } from './dto/list-meta-events.dto';

/** Tiempo tras el cual un evento tomado se considera abandonado y vuelve a la cola. */
const CLAIM_TIMEOUT_MS = 10 * 60_000;

interface ApiError {
  response?: {
    status: number;
    data?: { error?: { message?: string; error_user_msg?: string } };
  };
  message?: string;
}

type SanitizedMetaEvent = {
  id: string;
  organizationId: string;
  eventId: string;
  pixelId: string;
  eventName: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  safeEventData: {
    eventName: string | null;
    eventTime: number | null;
    eventSourceUrl: string | null;
    actionSource: string | null;
    eventId: string | null;
    customData: Record<string, unknown>;
    matchKeys: string[];
  };
};

@Injectable()
export class MetaConversionOutboxService {
  private readonly logger = new Logger(MetaConversionOutboxService.name);

  constructor(
    @InjectRepository(MetaConversionOutbox) private readonly outbox: Repository<MetaConversionOutbox>,
    private readonly conversions: MetaConversionsService,
    private readonly clientPixels: MetaClientPixelService,
  ) {}

  async enqueue(organizationId: string, pixelId: string, event: ConversionEvent): Promise<MetaConversionOutbox> {
    const eventId = event.eventId;
    if (!eventId) throw new Error('A stable eventId is required for Meta CAPI');
    const existing = await this.outbox.findOne({ where: { organizationId, eventId } });
    if (existing) return existing;
    return this.outbox.save(this.outbox.create({ organizationId, pixelId, eventId, eventData: event }));
  }

  /**
   * @param organizationId - Acota el conteo a una organizacion. El diagnostico por cron lo
   *   omite a proposito para ver la cola completa; cualquier consulta desde la aplicacion
   *   debe pasarlo para no exponer numeros de otras organizaciones.
   */
  async stats(organizationId?: string): Promise<{ pending: number; retry: number; processing: number; failed: number; processed: number; total: number }> {
    const scope = organizationId ? { organizationId } : {};
    const countBy = (status?: string) => this.outbox.count({ where: status ? { ...scope, status } : scope });
    const [pending, retry, processing, failed, processed, total] = await Promise.all([
      countBy('pending'),
      countBy('retry'),
      // 'processing' son eventos ya tomados por una ejecucion en curso. Si este numero no
      // baja entre diagnosticos, hay lotes quedandose atascados.
      countBy('processing'),
      countBy('failed'),
      countBy('processed'),
      countBy(),
    ]);
    return { pending, retry, processing, failed, processed, total };
  }

  /** Eventos que no lograron enviarse, con su motivo, para diagnosticar desde la aplicacion. */
  async recentProblems(organizationId: string, limit = 20): Promise<MetaConversionOutbox[]> {
    return this.outbox.find({
      where: [
        { organizationId, status: 'failed' },
        { organizationId, status: 'retry' },
      ],
      order: { updatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async listEvents(organizationId: string, query: ListMetaEventsDto): Promise<{ items: SanitizedMetaEvent[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const qb = this.outbox.createQueryBuilder('event')
      .where('event.organization_id = :organizationId', { organizationId });

    if (query.status) qb.andWhere('event.status = :status', { status: query.status });
    if (query.eventId) qb.andWhere('event.event_id LIKE :eventId', { eventId: `%${query.eventId}%` });
    if (query.eventName) {
      qb.andWhere("LOWER(JSON_UNQUOTE(JSON_EXTRACT(event.event_data, '$.eventName'))) LIKE :eventName", {
        eventName: `%${query.eventName.trim().toLowerCase()}%`,
      });
    }

    const [rows, total] = await qb
      .orderBy('event.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const items = rows.map((item) => this.sanitizeEvent(item));

    return { items, total, limit, offset };
  }

  async getEvent(organizationId: string, id: string): Promise<SanitizedMetaEvent> {
    const item = await this.outbox.findOne({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Evento CAPI no encontrado');
    return this.sanitizeEvent(item);
  }

  async retryEvent(organizationId: string, id: string): Promise<SanitizedMetaEvent> {
    const item = await this.outbox.findOne({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Evento CAPI no encontrado');
    if (item.status === 'processed') throw new BadRequestException('Un evento ya procesado no se reintenta');
    item.status = 'retry';
    item.nextAttemptAt = undefined;
    item.processedAt = undefined;
    const saved = await this.outbox.save(item);
    return this.sanitizeEvent(saved);
  }

  private sanitizeEvent(item: MetaConversionOutbox): SanitizedMetaEvent {
    const data = (item.eventData ?? {}) as ConversionEvent;
    const userData = (data.userData ?? {}) as Record<string, unknown>;
    const customData = (data.customData ?? {}) as Record<string, unknown>;
    return {
      id: item.id,
      organizationId: item.organizationId,
      eventId: item.eventId,
      pixelId: item.pixelId,
      eventName: data.eventName ?? null,
      status: item.status,
      attempts: item.attempts,
      lastError: item.lastError ?? null,
      nextAttemptAt: item.nextAttemptAt ?? null,
      processedAt: item.processedAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      safeEventData: {
        eventName: data.eventName ?? null,
        eventTime: data.eventTime ?? null,
        eventSourceUrl: data.eventSourceUrl ?? null,
        actionSource: data.actionSource ?? null,
        eventId: data.eventId ?? null,
        customData,
        matchKeys: Object.keys(userData).filter((key) => userData[key] !== undefined && userData[key] !== null),
      },
    };
  }

  /**
   * Devuelve a la cola los eventos tomados por una ejecución que no llegó a terminar.
   *
   * @param staleBefore - Momento a partir del cual un evento en `processing` se considera
   *   abandonado y vuelve a estar disponible.
   */
  private async releaseStaleClaims(manager: EntityManager, staleBefore: Date): Promise<void> {
    await manager.getRepository(MetaConversionOutbox)
      .createQueryBuilder()
      .update()
      .set({ status: 'retry' })
      .where('status = :status AND updated_at <= :staleBefore', { status: 'processing', staleBefore })
      .execute();
  }

  /**
   * Reserva un lote de eventos marcándolos como `processing`.
   *
   * La reserva ocurre en una transacción corta porque el bloqueo pesimista de TypeORM
   * requiere una transacción abierta, y el envío se hace fuera de ella para no mantener
   * filas bloqueadas durante llamadas HTTP a Meta.
   *
   * @param limit - Máximo de eventos a reservar.
   * @returns Los eventos reservados, ya marcados como en proceso.
   */
  private async claimBatch(limit: number): Promise<MetaConversionOutbox[]> {
    const now = new Date();
    return this.outbox.manager.transaction(async (manager) => {
      await this.releaseStaleClaims(manager, new Date(now.getTime() - CLAIM_TIMEOUT_MS));
      const repository = manager.getRepository(MetaConversionOutbox);
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
        const token = await this.clientPixels.resolveByPixel(item.organizationId, item.pixelId);
        if (!token) throw new Error('Meta conversion token is unavailable');
        await this.conversions.sendServerEvent(item.pixelId, token, item.eventData as ConversionEvent);
        item.status = 'processed';
        item.processedAt = new Date();
        item.lastError = undefined;
        processed += 1;
      } catch (error) {
        const apiError = error as ApiError;
        const statusCode = apiError?.response?.status;
        const isNonRetryable = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
        const bodyMsg: string = apiError?.response?.data?.error?.message ?? apiError?.response?.data?.error?.error_user_msg ?? '';
        const isExpiredToken = /expired|invalid.*token|permission|revoked|unauthorized/i.test(bodyMsg);

        item.attempts += 1;
        if (isNonRetryable || isExpiredToken || item.attempts >= 8) {
          item.status = 'failed';
          item.nextAttemptAt = undefined;
        } else {
          item.status = 'retry';
          item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
        }
        item.lastError = error instanceof Error ? error.message : 'Unknown CAPI error';
        if (statusCode) item.lastError = `HTTP ${statusCode}: ${item.lastError}`;
        if (isExpiredToken) item.lastError = `[TOKEN] ${item.lastError}`;
        failed += 1;
        this.logger.warn(`CAPI outbox ${item.id} failed${isNonRetryable || isExpiredToken ? ' (non-retryable)' : ''} (attempt ${item.attempts}): ${item.lastError}`);
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
}
