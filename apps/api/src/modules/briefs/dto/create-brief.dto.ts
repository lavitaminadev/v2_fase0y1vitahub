import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsIn } from 'class-validator';

export class CreateBriefDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() requirements?: Record<string, any>;
  @IsOptional() @IsString() @IsIn(['draft', 'sent', 'received', 'approved', 'archived']) status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
