import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Onboarding } from '../../modules/onboarding/onboarding.entity';
import { Notification } from '../notifications/notification.entity';
import { Piece } from '../../modules/production/piece.entity';
import { PieceVersion } from '../../modules/production/piece-version.entity';
import { Client } from '../../modules/clients/client.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { XPEvent } from '../../modules/gamification/xp-event.entity';
import { XPPeriod } from '../../modules/gamification/xp-period.entity';
import { UDBudget } from '../../modules/design-budget/ud-budget.entity';
import { UDMovement } from '../../modules/design-budget/ud-movement.entity';
import { User } from '../../modules/users/user.entity';
import { LeadConvertedHandler } from './handlers/lead-converted.handler';
import { PieceDeliveredHandler } from './handlers/piece-delivered.handler';
import { PieceAssignedHandler } from './handlers/piece-assigned.handler';
import { WorkflowsModule } from '../../modules/workflows/workflows.module';
import { Correction } from '../../modules/production/correction.entity';
import { BillingModule } from '../../modules/billing/billing.module';
import { PieceRejectedHandler } from './handlers/piece-rejected.handler';

@Module({
  imports: [
    DiscoveryModule,
    EventEmitterModule,
    TypeOrmModule.forFeature([
      Onboarding, Notification, Piece, PieceVersion, Client, Lead,
      XPEvent, XPPeriod, UDBudget, UDMovement, User,
      Correction,
    ]),
    WorkflowsModule,
    BillingModule,
  ],
  providers: [LeadConvertedHandler, PieceDeliveredHandler, PieceAssignedHandler, PieceRejectedHandler],
  exports: [EventEmitterModule],
})
export class EventsModule {}
