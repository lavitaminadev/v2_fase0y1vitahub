import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Onboarding } from './onboarding.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [TypeOrmModule.forFeature([Onboarding, Client, User]), WorkflowsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
