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

@Module({
  imports: [TypeOrmModule.forFeature([Integration, IntegrationAccount, IntegrationMetric, Client])],
  controllers: [GoogleController],
  providers: [GoogleOAuthService, GoogleDataService, GoogleCalendarService],
  exports: [GoogleOAuthService, GoogleCalendarService],
})
export class GoogleModule {}
