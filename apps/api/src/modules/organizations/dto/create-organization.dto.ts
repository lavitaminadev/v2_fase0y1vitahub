import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO para crear una nueva organización.
 */
export class CreateOrganizationDto {
  /** Nombre para mostrar de la organización. */
  @IsString() @MinLength(2) @MaxLength(255) name: string;

  /** Código único de la organización. */
  @IsString() @MinLength(2) @MaxLength(50) code: string;

  /** Código de moneda ISO 4217. */
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
