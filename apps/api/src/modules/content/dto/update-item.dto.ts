import { IsOptional, IsString, IsEnum, IsDateString, IsUUID, MaxLength } from 'class-validator';
import { ContentItemType } from '../content-item-type.enum';
import { ContentItemStatus } from '../content-item-status.enum';

/**
 * DTO for updating a content item.
 */
export class UpdateContentItemDto {
  /** Item type. */
  @IsOptional() @IsEnum(ContentItemType) type?: ContentItemType;
  /** Caption or title. */
  @IsOptional() @IsString() @MaxLength(255) caption?: string;
  /** Item status. */
  @IsOptional() @IsEnum(ContentItemStatus) status?: ContentItemStatus;
  /** Scheduled publication date. */
  @IsOptional() @IsDateString() scheduledAt?: string;
  /** Linked piece id. */
  @IsOptional() @IsUUID() pieceId?: string;
  /** Internal notes. */
  @IsOptional() @IsString() notes?: string;
}
