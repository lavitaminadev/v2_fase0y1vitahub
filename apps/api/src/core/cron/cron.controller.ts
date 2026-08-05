import { Controller, Get, Post, Headers, ForbiddenException, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { GoogleConversionOutboxService } from '../../modules/integrations/google/google-conversion-outbox.service';
import { DetectStalePiecesJob } from '../jobs/cron/detect-stale-pieces.job';
import { OperationalAlertsJob } from '../jobs/cron/operational-alerts.job';
import { CreateMonthlyCyclesJob } from '../jobs/cron/create-monthly-cycles.job';
import { CollectionEmailsJob } from '../jobs/cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from '../jobs/cron/purge-expired-leads.job';
import { CloseXpPeriodsJob } from '../jobs/cron/close-xp-periods.job';

@Controller('cron')
@Public()
export class CronController {
  private readonly running = new Set<string>();

  constructor(
    private readonly capiOutbox: MetaConversionOutboxService,
    private readonly googleOutbox: GoogleConversionOutboxService,
    private readonly stale: DetectStalePiecesJob,
    private readonly operationalAlerts: OperationalAlertsJob,
    private readonly cycles: CreateMonthlyCyclesJob,
    private readonly collections: CollectionEmailsJob,
    private readonly purge: PurgeExpiredLeadsJob,
    private readonly xp: CloseXpPeriodsJob,
  ) {}

  private verifySecret(secret?: string): void {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new ForbiddenException('CRON_SECRET not configured');
    const expectedBuf = Buffer.from(expected);
    const secretBuf = Buffer.from(secret ?? '');
    if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
      throw new ForbiddenException('Invalid cron secret');
    }
  }

  @Post('meta-capi')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processMetaCapiPost(@Headers('x-cron-secret') secret: string, @Body('limit') limit?: number) {
    this.verifySecret(secret);
    return this.runMetaCapi(limit);
  }

  @Get('meta-capi')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processMetaCapi(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runMetaCapi();
  }

  private async runMetaCapi(limit?: number) {
    const lockKey = 'meta-capi';
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      const result = await this.capiOutbox.processPending(limit ?? 50);
      return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  @Get('meta-capi/diagnostics')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async capiDiagnostics(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    const stats = await this.capiOutbox.stats();
    return { ok: true, ...stats, timestamp: new Date().toISOString() };
  }

  @Post('google-ads')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processGoogleAdsPost(@Headers('x-cron-secret') secret: string, @Body('limit') limit?: number) {
    this.verifySecret(secret);
    return this.runGoogleAds(limit);
  }

  @Get('google-ads')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processGoogleAds(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runGoogleAds();
  }

  private async runGoogleAds(limit?: number) {
    const lockKey = 'google-ads';
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      const result = await this.googleOutbox.processPending(limit ?? 50);
      return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  @Get('google-ads/diagnostics')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async googleAdsDiagnostics(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    const stats = await this.googleOutbox.stats();
    return { ok: true, ...stats, timestamp: new Date().toISOString() };
  }

  @Post('meta-capi/cleanup')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async cleanupOutbox(@Headers('x-cron-secret') secret: string, @Body('olderThanDays') olderThanDays?: number) {
    this.verifySecret(secret);
    const result = await this.capiOutbox.cleanup(olderThanDays ?? 7);
    return { ok: true, ...result, timestamp: new Date().toISOString() };
  }

  private async runLocked(lockKey: string, task: () => Promise<void>) {
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      await task();
      return { ok: true, timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  @Post('stale-pieces')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processStalePiecesPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('stale-pieces', () => this.stale.handle());
  }

  @Get('stale-pieces')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processStalePieces(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('stale-pieces', () => this.stale.handle());
  }

  @Post('operational-alerts')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processOperationalAlertsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
  }

  @Get('operational-alerts')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processOperationalAlerts(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
  }

  @Post('monthly-cycles')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processMonthlyCyclesPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('monthly-cycles', () => this.cycles.handle());
  }

  @Get('monthly-cycles')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processMonthlyCycles(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('monthly-cycles', () => this.cycles.handle());
  }

  @Post('collection-emails')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processCollectionEmailsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('collection-emails', () => this.collections.handle());
  }

  @Get('collection-emails')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processCollectionEmails(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('collection-emails', () => this.collections.handle());
  }

  @Post('data-retention')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processDataRetentionPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('data-retention', () => this.purge.handle());
  }

  @Get('data-retention')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processDataRetention(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('data-retention', () => this.purge.handle());
  }

  @Post('xp-periods')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processXpPeriodsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('xp-periods', () => this.xp.handle());
  }

  @Get('xp-periods')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processXpPeriods(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('xp-periods', () => this.xp.handle());
  }
}
