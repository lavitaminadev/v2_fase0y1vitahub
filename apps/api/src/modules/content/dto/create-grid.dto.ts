import { IsUUID, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class CreateGridDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  @IsDateString() weekStart: string;
  @IsDateString() weekEnd: string;
  @IsOptional() @IsString() notes?: string;
}
