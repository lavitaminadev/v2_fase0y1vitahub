import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SubmitVersionDto {
  @IsString() @MaxLength(255) fileName: string;
  @IsOptional() @IsString() @MaxLength(255) driveFileId?: string;
}
