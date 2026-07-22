import { IsString, IsOptional, IsEmail, IsUUID, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString() @MaxLength(255) name: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) position?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
