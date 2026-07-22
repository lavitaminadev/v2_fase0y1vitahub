import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApprovalDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @IsIn(['piece']) entityType: string;
  @IsUUID() entityId: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
