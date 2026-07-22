import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateMeetingDto } from './create-meeting.dto';
import { MeetingStatus } from '../meeting-status.enum';

export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {
  @IsOptional() @IsEnum(MeetingStatus) status?: MeetingStatus;
}
