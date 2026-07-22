import { ArrayMaxSize, IsString, IsOptional, IsDateString, IsArray, IsIn, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString() @Matches(/^[a-z0-9_-]{2,50}$/i) type: string;
  @IsUUID() clientId: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID(undefined, { each: true }) assignedTeam?: string[];
  @IsOptional() @IsUUID() moodboardId?: string;
  @IsOptional() @IsIn(['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled']) status?: string;
}
