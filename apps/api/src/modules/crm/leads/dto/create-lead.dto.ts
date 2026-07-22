import { IsString, IsOptional, IsEmail, MaxLength, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) source?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @IsString() @MaxLength(255) phone?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}
