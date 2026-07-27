import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MetaDataDeletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  signed_request?: string;
}
