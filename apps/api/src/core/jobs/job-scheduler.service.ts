import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { CloseXpPeriodsJob } from './cron/close-xp-periods.job';
import { CreateMonthlyCyclesJob } from './cron/create-monthly-cycles.job';
import { DetectStalePiecesJob } from './cron/detect-stale-pieces.job';
import { CollectionEmailsJob } from './cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from './cron/purge-expired-leads.job';
import { MetaLeadRecoveryJob } from './cron/meta-lead-recovery.job';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { OperationalAlertsJob } from './cron/operational-alerts.job';

@Injectable()
export class JobSchedulerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();

  constructor(
    private readonly xp: CloseXpPeriodsJob,
    private readonly cycles: CreateMonthlyCyclesJob,
    private readonly stale: DetectStalePiecesJob,
    private readonly collections: CollectionEmailsJob,
    private readonly purge: PurgeExpiredLeadsJob,
    private readonly metaRecovery: MetaLeadRecoveryJob,
    private readonly capiOutbox: MetaConversionOutboxService,
    private readonly operationalAlerts: OperationalAlertsJob,
  ) {}

  onModuleInit(): void {
    if (process.env.ENABLE_INTERNAL_SCHEDULER !== 'true') {
      this.logger.log('Internal scheduler disabled; use hosting cron or set ENABLE_INTERNAL_SCHEDULER=true');
      return;
    }
    this.schedule('meta-lead-recovery', 15 * 60_000, () => this.metaRecovery.handle());
    this.schedule('meta-capi-outbox', 5 * 60_000, () => this.capiOutbox.processPending());
    this.schedule('stale-pieces', 60 * 60_000, () => this.stale.handle());
    this.schedule('operational-alerts', 60 * 60_000, () => this.operationalAlerts.handle(), true);
    this.schedule('monthly-cycles', 24 * 60 * 60_000, () => this.cycles.handle(), true);
    this.schedule('collection-emails', 24 * 60 * 60_000, () => this.collections.handle());
    this.schedule('data-retention', 24 * 60 * 60_000, () => this.purge.handle());
    this.schedule('xp-periods', 6 * 60 * 60_000, () => this.xp.handle());
  }

  onApplicationShutdown(): void { for (const timer of this.timers) clearInterval(timer); }

  private schedule(name: string, interval: number, task: () => Promise<unknown>, runAtStartup = false): void {
    const run = async () => {
      if (this.running.has(name)) return;
      this.running.add(name);
      try { await task(); } catch (error) { this.logger.error(`${name} failed`, error instanceof Error ? error.stack : undefined); }
      finally { this.running.delete(name); }
    };
    if (runAtStartup) void run();
    const timer = setInterval(() => void run(), interval); timer.unref(); this.timers.push(timer);
  }
}
