import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsController } from './clients.controller';
import { CreateClientUseCase } from './create-client.use-case';
import { ListClientsUseCase } from './list-clients.use-case';
import { GetClientUseCase } from './get-client.use-case';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Client, User, Lead])],
  controllers: [ClientsController],
  providers: [CreateClientUseCase, ListClientsUseCase, GetClientUseCase],
})
export class ClientsModule {}
