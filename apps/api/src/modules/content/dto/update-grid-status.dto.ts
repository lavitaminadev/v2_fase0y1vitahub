import { IsEnum } from 'class-validator';
import { ContentGridStatus } from '../content-grid-status.enum';

export class UpdateGridStatusDto {
  @IsEnum(ContentGridStatus)
  status: ContentGridStatus;
}
