import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ListOpportunitiesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;
}
