import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { GetOperationsOverviewUseCase } from './get-operations-overview.use-case';

@Module({
  controllers: [OperationsController],
  providers: [GetOperationsOverviewUseCase],
})
export class OperationsModule {}
