import { IsEmail, IsString, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * Registration request body.
 */
export class RegisterDto {
  /** New user's email. */
  @IsEmail()
  email: string;

  /** Plain-text password (min 8 chars, must include uppercase, lowercase and number). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' })
  password: string;

  /** Display name. */
  @IsString()
  @MinLength(2)
  name: string;
}
