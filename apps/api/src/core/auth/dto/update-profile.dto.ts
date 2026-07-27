import { IsOptional, IsString, IsEmail, MaxLength, MinLength } from 'class-validator';

/**
 * Cuerpo del request de actualización de perfil.
 */
export class UpdateProfileDto {
  /** Nuevo nombre para mostrar. */
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) name?: string;

  /** Nueva dirección de email. */
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
}
