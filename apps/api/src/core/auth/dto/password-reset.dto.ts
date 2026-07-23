import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';

export class RequestPasswordResetDto {
  @IsEmail() @MaxLength(255) email: string;
}

export class CompletePasswordResetDto {
  @IsString() @MinLength(32) @MaxLength(255) token: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG }) password: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG }) newPassword: string;
}
