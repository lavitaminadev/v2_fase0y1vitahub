import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateOpportunityDto {
  @IsString() @MaxLength(255) name: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(50) stage?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsDateString() expectedCloseDate?: string;
  @IsOptional() @IsString() @MaxLength(500) nextAction?: string;
  @IsOptional() @IsDateString() nextActionAt?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
}
