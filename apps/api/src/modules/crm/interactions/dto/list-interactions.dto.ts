import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ListInteractionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;
}
