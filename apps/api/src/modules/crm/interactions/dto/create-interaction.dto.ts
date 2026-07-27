import { IsString, IsOptional, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class CreateInteractionDto {
  @IsString() @MaxLength(50) type: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() date?: string;
}
