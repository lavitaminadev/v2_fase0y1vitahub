import { IsEmail, IsString, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * Cuerpo del request de registro.
 */
export class RegisterDto {
  /** Email del nuevo usuario. */
  @IsEmail()
  email: string;

  /** Contraseña en texto plano (mín. 8 caracteres, debe incluir mayúscula, minúscula y número). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' })
  password: string;

  /** Nombre para mostrar. */
  @IsString()
  @MinLength(2)
  name: string;
}
