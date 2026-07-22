import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Login request body.
 */
export class LoginDto {
  /** Registered email address. */
  @IsEmail()
  email: string;

  /** Plain-text password. */
  @IsString()
  @MinLength(6)
  password: string;
}
