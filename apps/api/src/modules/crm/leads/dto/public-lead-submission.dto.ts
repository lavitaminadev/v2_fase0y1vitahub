import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Consentimiento del envío público. Separado del resto porque su finalidad (registrar
 * evidencia de consentimiento) es distinta de la finalidad comercial de los demás campos.
 */
export class PublicLeadConsentDto {
  @IsBoolean() privacyAccepted: boolean;
  @IsOptional() @IsBoolean() marketingAccepted?: boolean;
  @IsOptional() @IsString() @MaxLength(40) policyVersion?: string;
}

/** Datos de atribución de campaña, iguales en espíritu a los que ya captura la reserva pública. */
export class PublicLeadTrackingDto {
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(120) utmTerm?: string;
  @IsOptional() @IsString() @MaxLength(255) fbclid?: string;
  @IsOptional() @IsString() @MaxLength(255) gclid?: string;
  @IsOptional() @IsString() @MaxLength(500) landingUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) referrer?: string;
}

/**
 * Envío público de un formulario de captación comercial (Dominio B — prospectos de La
 * Vitamina). No confundir con `PublicReservationDto`: ese es Dominio A (comensales que
 * reservan en un restaurante cliente) y usa un endpoint, tabla de eventos y flujo de
 * conversión CAPI completamente distintos. Este DTO nunca debe tocar `reservations.service.ts`.
 */
export class PublicLeadSubmissionDto {
  @IsString() @MinLength(2) @MaxLength(180) name: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @Matches(/^[\d+\-\s()]+$/, { message: 'Invalid phone format' }) @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(255) website?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(255) serviceInterest?: string;
  @IsOptional() @IsString() @MaxLength(60) budgetRange?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;

  @IsObject() @ValidateNested() @Type(() => PublicLeadConsentDto) consent: PublicLeadConsentDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PublicLeadTrackingDto) tracking?: PublicLeadTrackingDto;

  /**
   * Campo trampa: un formulario real nunca lo llena porque va oculto por CSS; un bot que
   * completa todos los inputs del DOM sí. Si llega con valor, el envío se descarta.
   */
  @IsOptional() @IsString() @MaxLength(200) company_website_confirm?: string;

  @IsString() @MaxLength(80) idempotencyKey: string;
}
