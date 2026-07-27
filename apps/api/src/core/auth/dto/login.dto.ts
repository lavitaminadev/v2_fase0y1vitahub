import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Cuerpo del request de login.
 */
export class LoginDto {
  /** Dirección de email registrada. */
  @IsEmail()
  email: string;

  /** Contraseña en texto plano. */
  @IsString()
  @MinLength(6)
  password: string;
}
