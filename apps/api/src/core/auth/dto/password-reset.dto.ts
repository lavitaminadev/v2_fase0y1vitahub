import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail() @MaxLength(255) email: string;
}

export class CompletePasswordResetDto {
  @IsString() @MinLength(32) @MaxLength(255) token: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}
