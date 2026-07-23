import { IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { UserRole } from '../../organizations/user-role.enum';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) name?: string;

  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @IsOptional() @IsUUID() clientId?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' }) password?: string;

  @IsOptional() @IsIn(['presential', 'hybrid', 'remote']) workMode?: 'presential' | 'hybrid' | 'remote';

  @IsOptional() @IsNumber() @Min(1) @Max(1000) weeklyCapacityUd?: number;
}
