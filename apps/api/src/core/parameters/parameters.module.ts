import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';
import { ParameterResolver } from './parameter-resolver.service';
import { AuditModule } from '../audit/audit.module';
import { OrganizationSettingsController } from './organization-settings.controller';
import { OrganizationSettingsService } from './organization-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ParameterDefinition, ParameterValue]), AuditModule],
  controllers: [OrganizationSettingsController],
  providers: [ParameterResolver, OrganizationSettingsService],
  exports: [ParameterResolver, TypeOrmModule],
})
export class ParametersModule {}
