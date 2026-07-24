import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class UpdateLeadDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() @MaxLength(2000) discardReason?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
