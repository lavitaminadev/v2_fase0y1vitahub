import { IsOptional, IsString, IsDateString, MaxLength, IsIn } from 'class-validator';

export class UpdateBriefDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() requirements?: Record<string, any>;
  @IsOptional() @IsString() @IsIn(['draft', 'sent', 'received', 'approved', 'archived']) status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
