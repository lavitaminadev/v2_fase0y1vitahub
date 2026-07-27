import { IsUUID, IsInt, Min, Max, IsOptional } from 'class-validator';

export class GetOrCreateBudgetDto {
  @IsUUID() clientId: string;
  @IsInt() @Min(2024) year: number;
  @IsInt() @Min(1) @Max(12) month: number;
  @IsOptional() @IsInt() @Min(0) defaultBudget?: number;
}
