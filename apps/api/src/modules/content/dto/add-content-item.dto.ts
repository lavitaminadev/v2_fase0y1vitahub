import { IsOptional, IsString, IsUUID, IsDateString, MaxLength, IsEnum } from 'class-validator';
import { ContentItemType } from '../content-item-type.enum';
import { ContentItemStatus } from '../content-item-status.enum';

export class AddContentItemDto {
  @IsString() @MaxLength(255) caption: string;
  @IsEnum(ContentItemType) type: ContentItemType;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsEnum(ContentItemStatus) status?: ContentItemStatus;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsUUID() pieceId?: string;
}
