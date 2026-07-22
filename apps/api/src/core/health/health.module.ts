import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { IntegrationsHealthService } from './integrations-health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, IntegrationsHealthService],
  exports: [HealthService, IntegrationsHealthService],
})
export class HealthModule {}
