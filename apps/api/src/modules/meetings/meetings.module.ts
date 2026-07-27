import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './meeting.entity';
import { ActionItem } from './action-item.entity';
import { MeetingsController } from './meetings.controller';
import { CreateMeetingUseCase } from './create-meeting.use-case';
import { ListMeetingsUseCase } from './list-meetings.use-case';
import { GoogleModule } from '../integrations/google/google.module';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, ActionItem, Client, User]), GoogleModule],
  controllers: [MeetingsController],
  providers: [CreateMeetingUseCase, ListMeetingsUseCase],
})
export class MeetingsModule {}
