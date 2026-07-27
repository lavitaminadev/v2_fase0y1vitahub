import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const PROCESS_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const;

export class UpdateAccountCycleDto {
  @IsOptional() @IsIn(['planning', 'active', 'closed']) status?: string;
  @IsOptional() @IsIn(PROCESS_STATUSES) gridStatus?: string;
  @IsOptional() @IsIn(PROCESS_STATUSES) productionStatus?: string;
  @IsOptional() @IsInt() @Min(0) @Max(31) weeklyMeetingsCompleted?: number;
  @IsOptional() @IsIn(PROCESS_STATUSES) strategyMeetingStatus?: string;
  @IsOptional() @IsIn(PROCESS_STATUSES) reportStatus?: string;
}
