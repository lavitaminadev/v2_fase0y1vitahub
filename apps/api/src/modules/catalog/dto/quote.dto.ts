import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class QuoteItemDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsString() @MinLength(2) @MaxLength(255) description: string;
  @IsInt() @Min(1) @Max(10000) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
}

export class CreateQuoteDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsString() @MinLength(2) @MaxLength(255) title: string;
  @IsOptional() @IsString() @IsIn(['CLP', 'USD']) currency?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items: QuoteItemDto[];
}

export class UpdateQuoteDto extends CreateQuoteDto {}
