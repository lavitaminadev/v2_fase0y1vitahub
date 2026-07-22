import { ArrayMaxSize, IsOptional, IsString, IsDateString, IsArray, IsIn, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9_-]{2,50}$/i) type?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID(undefined, { each: true }) assignedTeam?: string[];
  @IsOptional() @IsUUID() moodboardId?: string;
  @IsOptional() @IsIn(['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled']) status?: string;
}
