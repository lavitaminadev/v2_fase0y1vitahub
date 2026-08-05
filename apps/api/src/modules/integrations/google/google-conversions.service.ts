import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { normalizeGeoValue } from '../../../shared/geo-inference';

/**
 * Subida de conversiones offline a Google Ads.
 *
 * Es el equivalente al Conversions API de Meta, pero en Google la integración
 * existente sólo leía métricas (`google-data.service.ts` hace pull de Ads y
 * GA4 hacia `integration_metric`). Esto cubre la dirección opuesta: reportar a
 * Google que una reserva ocurrió y, después, que el cliente asistió.
 *
 * Dos mecanismos de atribución, complementarios:
 * 1. `gclid` — el identificador de clic de Google, que ya se captura en
 *    `Reservation.clickId` desde la URL del anuncio. Es el más preciso.
 * 2. Enhanced Conversions — identificadores propios (email/teléfono hasheados
 *    + datos de dirección) que permiten atribuir aunque no haya gclid, por
 *    ejemplo si el usuario llegó por búsqueda orgánica tras ver el anuncio.
 *
 * Diferencia importante respecto a Meta: Google NO hashea los campos de
 * dirección (city, state, countryCode, postalCode); van en texto plano dentro
 * de `addressInfo`. Sólo se hashean email, teléfono, nombre y apellido.
 */

export interface GoogleConversionUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** ISO 3166-1 alpha-2, ej. 'cl'. Se envía en mayúsculas. */
  country?: string;
  /** Región/estado. Se envía en texto plano. */
  region?: string;
  /** Ciudad. Se envía en texto plano. */
  city?: string;
}

export interface GoogleClickConversion {
  /** Nombre de recurso: customers/{customerId}/conversionActions/{id} */
  conversionAction: string;
  /** gclid capturado desde la URL del anuncio (`Reservation.gclid`). */
  gclid?: string;
  /**
   * Identificadores de clic de campañas iOS y de aplicación, donde Google no entrega gclid.
   *
   * Google acepta exactamente uno de los tres por conversión, así que se emite el primero
   * disponible por ese orden de preferencia.
   */
  gbraid?: string;
  wbraid?: string;
  /** Identificador estable de la reserva, para deduplicación en Google. */
  orderId?: string;
  /** Momento de la conversión. */
  conversionDateTime: Date;
  /** Zona horaria IANA del formulario, ej. 'America/Santiago'. */
  timezone: string;
  conversionValue?: number;
  currencyCode?: string;
  userData: GoogleConversionUserData;
}

/** Normaliza y hashea según las reglas de Google (minúsculas, sin espacios). */
function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Google exige E.164 para el teléfono antes de hashear. Los números chilenos
 * locales se guardan sin código de país, igual que en el caso de Meta.
 */
export function normalizePhoneForGoogle(phone: string, defaultCountryPrefix = '56'): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 9 ? `+${defaultCountryPrefix}${digits}` : `+${digits}`;
}

/**
 * Google exige `conversionDateTime` con formato
 * 'yyyy-MM-dd HH:mm:ss+|-HH:mm' en la zona horaria de la cuenta.
 */
export function formatConversionDateTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  const stamp = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;

  // Desplazamiento real de la zona en esa fecha (respeta horario de verano).
  const asUtc = Date.UTC(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')), Number(get('minute')), Number(get('second')),
  );
  const offsetMinutes = Math.round((asUtc - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;

  return `${stamp}${offset}`;
}

/** Construye el array `userIdentifiers` de Enhanced Conversions. */
export function buildUserIdentifiers(userData: GoogleConversionUserData): Array<Record<string, unknown>> {
  const identifiers: Array<Record<string, unknown>> = [];

  if (userData.email) identifiers.push({ hashedEmail: hashIdentifier(userData.email) });
  if (userData.phone) {
    const normalized = normalizePhoneForGoogle(userData.phone);
    if (normalized) identifiers.push({ hashedPhoneNumber: hashIdentifier(normalized) });
  }

  // addressInfo requiere al menos nombre+apellido+país para ser útil; los
  // campos geográficos van sin hashear, a diferencia de Meta.
  const addressInfo: Record<string, unknown> = {};
  if (userData.firstName) addressInfo.hashedFirstName = hashIdentifier(userData.firstName);
  if (userData.lastName) addressInfo.hashedLastName = hashIdentifier(userData.lastName);
  if (userData.country) addressInfo.countryCode = normalizeGeoValue(userData.country).toUpperCase();
  if (userData.region) addressInfo.state = userData.region;
  if (userData.city) addressInfo.city = userData.city;
  if (Object.keys(addressInfo).length > 0) identifiers.push({ addressInfo });

  return identifiers;
}

@Injectable()
export class GoogleConversionsService {
  private readonly logger = new Logger(GoogleConversionsService.name);

  private adsApiVersion() {
    const version = process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24';
    return /^v\d+$/.test(version) ? version : 'v24';
  }

  private adsHeaders() {
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!developerToken) throw new BadRequestException('GOOGLE_DEVELOPER_TOKEN is required');
    return {
      'developer-token': developerToken,
      ...(process.env.GOOGLE_LOGIN_CUSTOMER_ID ? { 'login-customer-id': process.env.GOOGLE_LOGIN_CUSTOMER_ID } : {}),
    };
  }

  /** Arma el payload de una conversión sin enviarlo (facilita las pruebas). */
  buildPayload(conversion: GoogleClickConversion): Record<string, unknown> {
    const userIdentifiers = buildUserIdentifiers(conversion.userData);
    // Google rechaza una conversión que traiga más de un identificador de clic, así que se
    // elige uno solo. gclid primero por ser el más preciso; gbraid y wbraid cubren el tráfico
    // iOS y de aplicación, donde gclid no existe.
    const clickIdentifier = conversion.gclid
      ? { gclid: conversion.gclid }
      : conversion.gbraid
        ? { gbraid: conversion.gbraid }
        : conversion.wbraid
          ? { wbraid: conversion.wbraid }
          : undefined;

    if (!clickIdentifier && userIdentifiers.length === 0) {
      throw new BadRequestException('Se requiere un identificador de clic o al menos un identificador de usuario');
    }
    return {
      conversionAction: conversion.conversionAction,
      conversionDateTime: formatConversionDateTime(conversion.conversionDateTime, conversion.timezone),
      ...(clickIdentifier ?? {}),
      ...(conversion.orderId ? { orderId: conversion.orderId } : {}),
      ...(conversion.conversionValue !== undefined ? { conversionValue: conversion.conversionValue } : {}),
      ...(conversion.currencyCode ? { currencyCode: conversion.currencyCode } : {}),
      ...(userIdentifiers.length > 0 ? { userIdentifiers } : {}),
    };
  }

  /**
   * Sube una o más conversiones a Google Ads.
   *
   * Usa `partialFailure` para que un registro inválido no descarte el lote
   * completo; los errores por fila vuelven en `partialFailureError`.
   */
  async uploadClickConversions(
    customerId: string,
    accessToken: string,
    conversions: GoogleClickConversion[],
  ): Promise<{ results: unknown[]; partialFailureError?: unknown }> {
    if (conversions.length === 0) return { results: [] };

    const url = `https://googleads.googleapis.com/${this.adsApiVersion()}/customers/${customerId}:uploadClickConversions`;
    const body = {
      conversions: conversions.map((conversion) => this.buildPayload(conversion)),
      partialFailure: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...this.adsHeaders(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      const message = data?.error?.message ?? `Google Ads rechazó la subida (${response.status})`;
      this.logger.error(`Google Ads conversion upload failed: ${message}`);
      throw new BadRequestException(message);
    }

    if (data?.partialFailureError) {
      this.logger.warn(`Google Ads partial failure: ${data.partialFailureError.message ?? 'sin detalle'}`);
    }

    return { results: data?.results ?? [], partialFailureError: data?.partialFailureError };
  }
}
