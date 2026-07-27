import { IsOptional, IsString, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class UpdateInteractionDto {
  @IsOptional() @IsString() @MaxLength(50) type?: string;
  @IsOptional() @IsUUID() leadId?: string | null;
  @IsOptional() @IsUUID() contactId?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() date?: string;
}
