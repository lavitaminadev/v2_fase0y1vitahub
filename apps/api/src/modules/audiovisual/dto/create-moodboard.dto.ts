import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreateMoodboardDto {
  @IsString() @MaxLength(255) title: string;
  @IsUUID() clientId: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUrl({ require_protocol: true }, { each: true }) images?: string[];
  @IsOptional() @IsIn(['draft', 'review', 'approved', 'rejected']) status?: string;
}
