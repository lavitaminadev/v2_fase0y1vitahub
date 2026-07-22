import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './meeting.entity';
import { MeetingType } from './meeting-type.enum';

@Injectable()
export class CreateMeetingUseCase {
  constructor(
    @InjectRepository(Meeting) private repo: Repository<Meeting>,
  ) {}

  async execute(data: {
    organizationId: string; title: string; type: MeetingType;
    scheduledAt: Date; durationMinutes?: number; createdBy: string;
    clientId?: string; location?: string; meetingLink?: string; minutes?: string;
  }) {
    const meeting = this.repo.create(data);
    return this.repo.save(meeting);
  }
}
