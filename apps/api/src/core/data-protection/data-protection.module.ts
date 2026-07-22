import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/user.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { DataProtectionService } from './data-protection.service';
import { DataProtectionController } from './data-protection.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Lead, AuditLog, DataConsent])],
  controllers: [DataProtectionController],
  providers: [DataProtectionService],
  exports: [DataProtectionService],
})
export class DataProtectionModule {}
