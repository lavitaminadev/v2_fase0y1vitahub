import { IsString, IsEmail, Matches, MinLength, MaxLength, IsOptional, IsUUID, IsEnum, IsIn, IsNumber, Min, Max } from 'class-validator';
import { UserRole } from '../../organizations/user-role.enum';

/**
 * DTO para crear un nuevo usuario dentro de la organización del solicitante.
 */
export class CreateUserDto {
  /** Nombre para mostrar. */
  @IsString() @MinLength(2) @MaxLength(255) name: string;

  /** Dirección de email única. */
  @IsEmail() email: string;

  /** Contraseña inicial en texto plano (mín. 8 caracteres, debe incluir mayúscula, minúscula y número). */
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' }) password: string;

  /** Número de teléfono opcional. */
  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  /** Rol asignado al usuario. Por defecto, diseñador. */
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  /** Cuenta de cliente vinculada cuando este es un usuario de portal/cliente. */
  @IsOptional() @IsUUID() clientId?: string;

  /** Modalidad de trabajo usada por operaciones y planificación de capacidad. */
  @IsOptional() @IsIn(['presential', 'hybrid', 'remote']) workMode?: 'presential' | 'hybrid' | 'remote';

  @IsOptional() @IsNumber() @Min(1) @Max(1000) weeklyCapacityUd?: number;
}
