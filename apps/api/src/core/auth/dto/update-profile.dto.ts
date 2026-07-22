import { IsOptional, IsString, IsEmail, MaxLength, MinLength } from 'class-validator';

/**
 * Profile update request body.
 */
export class UpdateProfileDto {
  /** New display name. */
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) name?: string;

  /** New email address. */
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
}
