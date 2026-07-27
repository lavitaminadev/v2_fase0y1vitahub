import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, IsEnum, IsDateString, IsArray } from 'class-validator';
import { PieceType } from '../piece-type.enum';

export class CreatePieceDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  @IsEnum(PieceType) type: PieceType;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficultyLevel?: number;
  @IsOptional() @IsInt() @Min(2) @Max(20) carouselSlides?: number;
  @IsOptional() @IsDateString() deadlineAt?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) dependencyIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
