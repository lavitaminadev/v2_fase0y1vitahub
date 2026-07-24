import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para actualizar el perfil de una organización.
 */
export class UpdateOrganizationDto {
  /** Nombre para mostrar actualizado. */
  @IsOptional() @IsString() @MaxLength(255) name?: string;

  /** Código de moneda ISO 4217 actualizado. */
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
