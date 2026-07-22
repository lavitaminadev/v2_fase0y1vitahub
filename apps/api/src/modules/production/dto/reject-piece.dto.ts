import { IsString, IsUUID, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { CorrectionOrigin } from '../correction-origin.enum';

export class RejectPieceDto {
  @IsOptional() @IsUUID() versionId?: string;
  @IsString() @MaxLength(2000) comment: string;
  @IsEnum(CorrectionOrigin) origin: CorrectionOrigin;
}
