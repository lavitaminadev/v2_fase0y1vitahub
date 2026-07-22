import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XPPeriod } from '../../modules/gamification/xp-period.entity';
import { XPEvent } from '../../modules/gamification/xp-event.entity';
import { Client } from '../../modules/clients/client.entity';
import { UDBudget } from '../../modules/design-budget/ud-budget.entity';
import { Piece } from '../../modules/production/piece.entity';
import { Notification } from '../notifications/notification.entity';
import { Invoice } from '../../modules/billing/invoice.entity';
import { EmailModule } from '../notifications/email.module';
import { CloseXpPeriodsJob } from './cron/close-xp-periods.job';
import { CreateMonthlyCyclesJob } from './cron/create-monthly-cycles.job';
import { DetectStalePiecesJob } from './cron/detect-stale-pieces.job';
import { CollectionEmailsJob } from './cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from './cron/purge-expired-leads.job';
import { MetaLeadRecoveryJob } from './cron/meta-lead-recovery.job';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { IntegrationAccount } from '../../modules/integrations/integration-account.entity';
import { DataProtectionModule } from '../data-protection/data-protection.module';
import { MetaModule } from '../../modules/integrations/meta/meta.module';
import { AccountCyclesModule } from '../../modules/account-cycles/account-cycles.module';
import { JobSchedulerService } from './job-scheduler.service';
import { ParametersModule } from '../parameters/parameters.module';
import { OperationalAlertsJob } from './cron/operational-alerts.job';

@Module({
  imports: [TypeOrmModule.forFeature([XPPeriod, XPEvent, Client, UDBudget, Piece, Notification, Invoice, Lead, IntegrationAccount]), EmailModule, DataProtectionModule, MetaModule, AccountCyclesModule, ParametersModule],
  providers: [CloseXpPeriodsJob, CreateMonthlyCyclesJob, DetectStalePiecesJob, CollectionEmailsJob, PurgeExpiredLeadsJob, MetaLeadRecoveryJob, OperationalAlertsJob, JobSchedulerService],
  exports: [CloseXpPeriodsJob, CreateMonthlyCyclesJob, DetectStalePiecesJob, CollectionEmailsJob, PurgeExpiredLeadsJob, MetaLeadRecoveryJob, OperationalAlertsJob],
})
export class JobsModule {}
