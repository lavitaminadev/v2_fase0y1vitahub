import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';

/**
 * Consentimientos que toda cuenta nueva debe aceptar antes de operar.
 *
 * Las claves se validan contra esta lista para que el registro guardado sea comparable en
 * el tiempo: un consentimiento con una clave inventada no probaría nada.
 */
export const REQUIRED_CONSENTS = [
  'terms',
  'dataTreatment',
  'confidentiality',
  'properUse',
  'noDisclosure',
] as const;

/** Versión del texto aceptado. Se sube cuando cambian las condiciones y hay que re-aceptar. */
export const TERMS_VERSION = 'v1';

/** Datos que cada persona completa sobre sí misma; administración no los rellena por ella. */
export class OnboardingProfileDto {
  @IsString() @MinLength(3) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(30) @Matches(/^\+?[\d\s-]{7,}$/, { message: 'Teléfono inválido' }) phone?: string;
  @IsOptional() @IsIn(['presential', 'hybrid', 'remote']) workMode?: 'presential' | 'hybrid' | 'remote';
}

/**
 * Primer ingreso completo: contraseña propia, consentimientos y datos personales.
 *
 * Va en una sola operación porque las tres cosas deben ocurrir juntas: una cuenta con
 * contraseña cambiada pero sin consentimiento registrado sería un estado imposible de
 * justificar más tarde.
 */
export class CompleteOnboardingDto {
  @IsString() @MinLength(8) @MaxLength(128) currentPassword: string;

  @IsString() @MinLength(8) @MaxLength(128) @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  newPassword: string;

  @IsArray() @ArrayMinSize(REQUIRED_CONSENTS.length)
  @IsIn(REQUIRED_CONSENTS as unknown as string[], { each: true })
  acceptedConsents: string[];

  @Type(() => OnboardingProfileDto)
  profile: OnboardingProfileDto;
}

/** Renovación de condiciones para una cuenta ya activa. */
export class AcceptTermsDto {
  @IsArray() @ArrayMinSize(REQUIRED_CONSENTS.length)
  @IsIn(REQUIRED_CONSENTS as unknown as string[], { each: true })
  acceptedConsents: string[];
}
