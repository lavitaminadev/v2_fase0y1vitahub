import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './contract.entity';
import { ContractService } from './contract-service.entity';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Client } from '../clients/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractService, Client])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
