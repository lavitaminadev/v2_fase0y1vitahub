import { IsOptional, IsString, IsNumber, IsDateString, IsUUID, MaxLength, IsIn, Min } from 'class-validator';

export class UpdateContractDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(255) serviceType?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Min(0) monthlyUd?: number;
  @IsOptional() @IsString() @IsIn(['active', 'paused', 'ended', 'cancelled']) status?: string;
  @IsOptional() @IsString() terms?: string;
  @IsOptional() @IsUUID() packId?: string;
  @IsOptional() @IsNumber() @Min(0) monthlyPrice?: number;
  @IsOptional() @IsNumber() @Min(0) committedAdSpend?: number;
  @IsOptional() @IsNumber() @Min(0) includedReels?: number;
  @IsOptional() @IsString() @IsIn(['monthly_advance', 'monthly_arrears', 'quarterly_advance']) billingCycle?: string;
}
