import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class ListLeadsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsUUID() clientId?: string;
}
