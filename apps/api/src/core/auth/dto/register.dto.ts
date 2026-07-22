import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Registration request body.
 */
export class RegisterDto {
  /** New user's email. */
  @IsEmail()
  email: string;

  /** Plain-text password (min 6 characters). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  /** Display name. */
  @IsString()
  @MinLength(2)
  name: string;

}
