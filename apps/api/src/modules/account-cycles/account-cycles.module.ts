import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountCycle } from './account-cycle.entity';
import { AccountCyclesController } from './account-cycles.controller';
import { AccountCyclesService } from './account-cycles.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountCycle])],
  controllers: [AccountCyclesController],
  providers: [AccountCyclesService],
  exports: [AccountCyclesService],
})
export class AccountCyclesModule {}
