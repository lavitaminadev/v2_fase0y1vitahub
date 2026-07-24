import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleController } from './google.controller';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationMetric } from '../integration-metric.entity';
import { GoogleDataService } from './google-data.service';
import { GoogleCalendarService } from './google-calendar.service';
import { Client } from '../../clients/client.entity';
import { GoogleConversionsService } from './google-conversions.service';
import { GoogleConversionOutbox } from './google-conversion-outbox.entity';
import { GoogleConversionOutboxService } from './google-conversion-outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([Integration, IntegrationAccount, IntegrationMetric, Client, GoogleConversionOutbox])],
  controllers: [GoogleController],
  providers: [GoogleOAuthService, GoogleDataService, GoogleCalendarService, GoogleConversionsService, GoogleConversionOutboxService],
  exports: [GoogleOAuthService, GoogleCalendarService, GoogleConversionsService, GoogleConversionOutboxService],
})
export class GoogleModule {}
