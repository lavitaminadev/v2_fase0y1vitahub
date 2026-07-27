import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para actualizar el perfil de una organización.
 */
export class UpdateOrganizationDto {
  /** Nombre para mostrar actualizado. */
  @IsOptional() @IsString() @MaxLength(255) name?: string;

  /** Codigo de moneda ISO 4217 actualizado. */
  @IsOptional() @IsString() @MaxLength(3) currency?: string;

  /** URL del logo de la organizacion. */
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;

  /** Mensaje de bienvenida para nuevos usuarios. */
  @IsOptional() @IsString() @MaxLength(500) welcomeMessage?: string;
}
