import { IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class GenerateMonthlyReportDto {
  @IsUUID() clientId: string;
  @IsInt() @Min(2020) @Max(2100) year: number;
  @IsInt() @Min(1) @Max(12) month: number;
}

export class UpdateMonthlyReportDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) executiveSummary?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) insights?: string[];
  @IsOptional() @IsString() @MaxLength(10000) recommendations?: string;
  @IsOptional() @IsNumber() @Min(0) salesGenerated?: number;
}
