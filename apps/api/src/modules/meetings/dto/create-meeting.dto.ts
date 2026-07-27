import { IsString, IsOptional, IsUUID, IsDateString, IsEnum, MaxLength, IsInt, Min, Max, IsUrl } from 'class-validator';
import { MeetingType } from '../meeting-type.enum';

export class CreateMeetingDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsEnum(MeetingType) type?: MeetingType;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(10000) minutes?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
  @IsOptional() @IsInt() @Min(15) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(255) meetingLink?: string;
}
