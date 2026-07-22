import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Objective } from './objective.entity';
import { ObjectivesController } from './objectives.controller';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

@Module({ imports: [TypeOrmModule.forFeature([Objective, Client, User])], controllers: [ObjectivesController] })
export class ObjectivesModule {}
