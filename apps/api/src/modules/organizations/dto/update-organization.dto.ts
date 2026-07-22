import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for updating an organization profile.
 */
export class UpdateOrganizationDto {
  /** Updated display name. */
  @IsOptional() @IsString() @MaxLength(255) name?: string;

  /** Updated ISO 4217 currency code. */
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
