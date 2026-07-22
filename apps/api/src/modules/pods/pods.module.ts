import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { PodMember } from './pod-member.entity';
import { Pod } from './pod.entity';
import { PodsController } from './pods.controller';
import { PodsService } from './pods.service';

@Module({ imports: [TypeOrmModule.forFeature([Pod, PodMember, User, Client])], controllers: [PodsController], providers: [PodsService], exports: [PodsService] })
export class PodsModule {}
