import { IsArray, IsIn, IsString, IsOptional, IsUUID, IsUrl, Matches, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) name: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) fileUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) @Matches(/^[A-Za-z0-9_-]+$/) driveFileId?: string;
  @IsOptional() @IsString() @IsIn(['draft', 'review', 'approved', 'archived']) status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) tags?: string[];
}
