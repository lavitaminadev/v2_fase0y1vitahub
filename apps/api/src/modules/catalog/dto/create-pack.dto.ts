import { IsString, IsOptional, IsNumber, IsJSON, Matches, MaxLength, Min } from 'class-validator';

export class CreatePackDto {
  @IsString() @MaxLength(255) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsNumber() @Min(0) monthlyUd?: number;
  @IsOptional() @IsNumber() @Min(0) reelsIncluded?: number;
  @IsOptional() @IsNumber() @Min(0) monthlyPrice?: number;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsJSON() @MaxLength(20000) services?: string;
}
