import { Controller, Get, Post, Headers, ForbiddenException, Query, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { SkipTenancy } from '../tenancy/skip-tenancy.decorator';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';

@Controller('cron')
@Public()
@SkipTenancy()
export class CronController {
  private readonly running = new Set<string>();

  constructor(
    private readonly capiOutbox: MetaConversionOutboxService,
  ) {}

  private verifySecret(secret?: string): void {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new ForbiddenException('CRON_SECRET not configured');
    if (!secret || secret !== expected) throw new ForbiddenException('Invalid cron secret');
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
}
