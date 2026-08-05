import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';

/** Tiempo tras el cual un evento tomado se considera abandonado y vuelve a la cola. */
const CLAIM_TIMEOUT_MS = 10 * 60_000;

/**
 * Ventana que Meta acepta para recibir una conversión pasada, según el origen del evento.
 *
 * Los eventos de tienda física admiten 62 días porque describen algo que ocurrió en el
 * local y suelen cargarse con retraso: la asistencia se marca cuando alguien la registra, no
 * cuando el comensal llega. Aplicarles el corte de 7 días descartaba localmente conversiones
 * que Meta sí habría aceptado, incluida toda importación de histórico.
 */
const MAX_AGE_DAYS_BY_ACTION_SOURCE: Record<string, number> = {
  physical_store: 62,
};

/** Ventana por defecto, para eventos originados en la web. */
const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Códigos con los que Meta señala que el token dejó de servir.
 *
 * `190` es el de OAuth: cubre token vencido, revocado y sesión invalidada por cambio de
 * contraseña. Se prefiere al texto del mensaje porque el texto cambia con el idioma y con la
 * versión de la API.
 */
const META_OAUTH_ERROR_CODE = 190;

interface ApiError {
  response?: {
    status: number;
    data?: { error?: { message?: string; error_user_msg?: string; code?: number; type?: string } };
  };
  message?: string;
}

/** Estados en los que un evento ya no volverá a intentarse. */
const TERMINAL_STATUSES = ['failed', 'expired'] as const;

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
  async stats(organizationId?: string): Promise<{ pending: number; retry: number; processing: number; failed: number; expired: number; processed: number; total: number }> {
    const scope = organizationId ? { organizationId } : {};
    const countBy = (status?: string) => this.outbox.count({ where: status ? { ...scope, status } : scope });
    const [pending, retry, processing, failed, expired, processed, total] = await Promise.all([
      countBy('pending'),
      countBy('retry'),
      // 'processing' son eventos ya tomados por una ejecucion en curso. Si este numero no
      // baja entre diagnosticos, hay lotes quedandose atascados.
      countBy('processing'),
      countBy('failed'),
      // Se cuenta aparte porque es una conversion perdida de forma definitiva. Omitirlo hacia
      // que la suma de estados no cuadrara con el total y que una perdida por antiguedad no
      // apareciera en ningun numero.
      countBy('expired'),
      countBy('processed'),
      countBy(),
    ]);
    return { pending, retry, processing, failed, expired, processed, total };
  }

  /** Eventos que no lograron enviarse, con su motivo, para diagnosticar desde la aplicacion. */
  async recentProblems(organizationId: string, limit = 20): Promise<MetaConversionOutbox[]> {
    return this.outbox.find({
      where: [
        { organizationId, status: 'failed' },
        { organizationId, status: 'expired' },
        { organizationId, status: 'retry' },
      ],
      order: { updatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
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
        // Pasada la ventana de Meta el evento ya no puede atribuirse. Sin este corte agotaba
        // los ocho reintentos contra una ventana cerrada y terminaba como un fallo generico.
        const event = item.eventData as ConversionEvent;
        const eventTime = Number(event?.eventTime ?? 0);
        const maxAgeDays = MAX_AGE_DAYS_BY_ACTION_SOURCE[event?.actionSource ?? ''] ?? DEFAULT_MAX_AGE_DAYS;
        if (eventTime > 0 && Date.now() - eventTime * 1000 > maxAgeDays * 86_400_000) {
          item.status = 'expired';
          item.nextAttemptAt = undefined;
          item.lastError = `El evento supera los ${maxAgeDays} días que acepta Meta para su origen y ya no puede atribuirse.`;
          await this.outbox.save(item);
          failed += 1;
          continue;
        }
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
        const metaError = apiError?.response?.data?.error;
        const bodyMsg: string = metaError?.message ?? metaError?.error_user_msg ?? '';
        // Se mira primero el código, que Meta mantiene estable. El texto queda como respaldo
        // para respuestas que no lo traigan: la revocación más común —"the session has been
        // invalidated because the user changed their password"— no la reconocía ninguna
        // variante del texto, así que caía a fallo genérico y el aviso nunca aparecía.
        const isExpiredToken = metaError?.code === META_OAUTH_ERROR_CODE
          || metaError?.type === 'OAuthException'
          || /expired|invalid.*token|invalidated|revoked|unauthorized/i.test(bodyMsg);

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

  /**
   * Borra lo que ya no volverá a intentarse.
   *
   * Incluye los eventos vencidos: sin ellos la tabla crecía sin techo, porque eran el único
   * estado terminal que nada limpiaba.
   */
  async cleanup(olderThanDays = 7): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
    const result = await this.outbox.delete({ status: 'processed', processedAt: LessThanOrEqual(cutoff) });
    const terminalResult = await this.outbox.delete({ status: In([...TERMINAL_STATUSES]), createdAt: LessThanOrEqual(cutoff) });
    return { deleted: (result.affected ?? 0) + (terminalResult.affected ?? 0) };
  }
}
