import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO for creating a new organization.
 */
export class CreateOrganizationDto {
  /** Organization display name. */
  @IsString() @MinLength(2) @MaxLength(255) name: string;

  /** Unique organization code. */
  @IsString() @MinLength(2) @MaxLength(50) code: string;

  /** ISO 4217 currency code. */
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
