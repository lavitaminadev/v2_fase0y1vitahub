import { IsOptional, IsString, IsUUID, MaxLength, IsIn, IsArray } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional() @IsString() @MaxLength(255) step?: string;
  @IsOptional() @IsString() @IsIn(['pending', 'in_progress', 'blocked', 'completed']) status?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() @MaxLength(1000) blockedReason?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(255, { each: true }) requiredDocuments?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(255, { each: true }) receivedDocuments?: string[];
}
