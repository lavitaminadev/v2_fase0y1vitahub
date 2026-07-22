import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';

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
    return this.outbox.save(this.outbox.create({ organizationId, pixelId, eventId, eventData: event as any }));
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
    });
    let processed = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const token = await this.clientPixels.resolveByPixel(item.organizationId, item.pixelId);
        if (!token) throw new Error('Meta conversion token is unavailable');
        await this.conversions.sendServerEvent(item.pixelId, token, item.eventData as unknown as ConversionEvent);
        item.status = 'processed';
        item.processedAt = new Date();
        item.lastError = undefined;
        processed += 1;
      } catch (error) {
        item.attempts += 1;
        item.status = item.attempts >= 8 ? 'failed' : 'retry';
        item.lastError = error instanceof Error ? error.message : 'Unknown CAPI error';
        item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
        failed += 1;
        this.logger.warn(`CAPI outbox ${item.id} failed (attempt ${item.attempts})`);
      }
      await this.outbox.save(item);
    }
    return { processed, failed };
  }
}
