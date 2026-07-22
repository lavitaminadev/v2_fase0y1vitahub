import { IsBoolean, IsOptional } from 'class-validator';

export class ResetUserPasswordDto {
  @IsOptional() @IsBoolean() sendEmail?: boolean;
}
