import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloudinaryConfigDto {
  @IsOptional() @IsString() @MaxLength(120)
  cloudName?: string;

  @IsOptional() @IsString() @MaxLength(120)
  apiKey?: string;

  @IsOptional() @IsString() @MaxLength(255)
  apiSecret?: string;
}
