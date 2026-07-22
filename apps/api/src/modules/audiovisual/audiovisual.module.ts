import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Moodboard } from './moodboard.entity';
import { Session } from './session.entity';
import { AudiovisualController } from './audiovisual.controller';
import { AudiovisualService } from './audiovisual.service';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Moodboard, Session, Client, User])],
  controllers: [AudiovisualController],
  providers: [AudiovisualService],
})
export class AudiovisualModule {}
