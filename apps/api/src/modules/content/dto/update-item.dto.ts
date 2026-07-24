import { IsOptional, IsString, IsEnum, IsDateString, IsUUID, MaxLength } from 'class-validator';
import { ContentItemType } from '../content-item-type.enum';
import { ContentItemStatus } from '../content-item-status.enum';

/**
 * DTO para actualizar un item de contenido.
 */
export class UpdateContentItemDto {
  /** Tipo de item. */
  @IsOptional() @IsEnum(ContentItemType) type?: ContentItemType;
  /** Copy o título. */
  @IsOptional() @IsString() @MaxLength(255) caption?: string;
  /** Estado del item. */
  @IsOptional() @IsEnum(ContentItemStatus) status?: ContentItemStatus;
  /** Fecha de publicación programada. */
  @IsOptional() @IsDateString() scheduledAt?: string;
  /** Id de pieza vinculada. */
  @IsOptional() @IsUUID() pieceId?: string;
  /** Notas internas. */
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
