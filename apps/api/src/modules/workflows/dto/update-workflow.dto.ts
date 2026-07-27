import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class WorkflowStepDto {
  @IsString() @MinLength(1) @MaxLength(80) key: string;
  @IsString() @MinLength(2) @MaxLength(180) label: string;
  @IsOptional() @IsString() @MaxLength(60) responsibleRole?: string;
  @IsOptional() @IsInt() @Min(1) @Max(8760) slaHours?: number;
  @IsBoolean() required: boolean;
}

export class UpdateWorkflowDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkflowStepDto) steps?: WorkflowStepDto[];
}
