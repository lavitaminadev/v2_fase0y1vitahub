import { IsString, IsEmail, Matches, MinLength, MaxLength, IsOptional, IsUUID, IsEnum, IsIn, IsNumber, Min, Max } from 'class-validator';
import { UserRole } from '../../organizations/user-role.enum';

/**
 * DTO for creating a new user inside the caller organization.
 */
export class CreateUserDto {
  /** Display name. */
  @IsString() @MinLength(2) @MaxLength(255) name: string;

  /** Unique email address. */
  @IsEmail() email: string;

  /** Plain-text initial password (min 8 chars, must include uppercase, lowercase and number). */
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' }) password: string;

  /** Optional phone number. */
  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  /** Role assigned to the user. Defaults to designer. */
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  /** Linked client account when this is a portal/client user. */
  @IsOptional() @IsUUID() clientId?: string;

  /** Work modality used by operations and capacity planning. */
  @IsOptional() @IsIn(['presential', 'hybrid', 'remote']) workMode?: 'presential' | 'hybrid' | 'remote';

  @IsOptional() @IsNumber() @Min(1) @Max(1000) weeklyCapacityUd?: number;
}
