import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateObjectiveDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsString() @Matches(/^[a-z0-9_-]{2,30}$/i) category: string;
  @IsString() @MinLength(2) @MaxLength(255) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsIn(['active', 'paused', 'completed', 'cancelled']) status?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class UpdateObjectiveDto extends PartialType(CreateObjectiveDto) {}
