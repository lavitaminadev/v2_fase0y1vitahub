import { ArrayMaxSize, IsIn, IsOptional, IsString, IsArray, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class UpdateMoodboardDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUrl({ require_protocol: true }, { each: true }) images?: string[];
  @IsOptional() @IsUUID() verifiedBy?: string;
  @IsOptional() @IsIn(['draft', 'review', 'approved', 'rejected']) status?: string;
}
