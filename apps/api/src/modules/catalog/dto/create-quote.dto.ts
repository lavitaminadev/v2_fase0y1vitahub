import { IsUUID, IsString, IsNumber, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateQuoteDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  @IsNumber() amount: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() items?: Record<string, any>[];
  @IsOptional() @IsString() notes?: string;
}
