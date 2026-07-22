import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ActionItemStatus } from '../action-item-status.enum';

export class UpdateActionItemDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsEnum(ActionItemStatus) status?: ActionItemStatus;
}
