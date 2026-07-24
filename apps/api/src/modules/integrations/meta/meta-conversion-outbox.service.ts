import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';

interface ApiError {
  response?: {
    status: number;
    data?: { error?: { message?: string; error_user_msg?: string } };
  };
  message?: string;
}

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
