import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateActionItemDto {
  @IsString() description: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
