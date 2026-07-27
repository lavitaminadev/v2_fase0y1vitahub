import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from './integration.entity';
import { IntegrationAccount } from './integration-account.entity';
import { IntegrationsController } from './integrations.controller';
import { CreateIntegrationUseCase } from './create-integration.use-case';
import { ListIntegrationsUseCase } from './list-integrations.use-case';
import { UpdateIntegrationUseCase } from './update-integration.use-case';
import { IntegrationMetric } from './integration-metric.entity';
import { Client } from '../clients/client.entity';
import { IntegrationAccountsService } from './integration-accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Integration, IntegrationAccount, IntegrationMetric, Client])],
  controllers: [IntegrationsController],
  providers: [CreateIntegrationUseCase, ListIntegrationsUseCase, UpdateIntegrationUseCase, IntegrationAccountsService],
  exports: [TypeOrmModule, IntegrationAccountsService],
})
export class IntegrationsModule {}
