import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'node:crypto';
import { BadGatewayException } from '@nestjs/common';
import { normalizeGeoValue } from '../../../shared/geo-inference';

export interface ConversionEvent {
  eventName: string;
  eventTime: number;
  eventSourceUrl?: string;
  actionSource?: string;
  userData: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
    externalId?: string[];
    /** Ciudad normalizada (minúsculas, sin acentos ni espacios). */
    ct?: string[];
    /** Región/estado normalizado. */
    st?: string[];
    /** ISO 3166-1 alpha-2 en minúsculas, ej. 'cl'. */
    country?: string[];
  };
  customData?: {
    currency?: string;
    value?: number;
    contentIds?: string[];
    contentType?: string;
    clientId?: string;
    formId?: string;
    reservationId?: string;
    referenceCode?: string;
  };
  eventId?: string;
}

@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);
  constructor(private readonly http: HttpService) {}

  async sendEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    const payload = {
      data: [{
        event_name: event.eventName,
        event_time: event.eventTime,
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource ?? 'system_generated',
        user_data: {
          em: event.userData.em,
          ph: event.userData.ph,
          fn: event.userData.fn,
          ln: event.userData.ln,
          external_id: event.userData.externalId,
          ct: event.userData.ct,
          st: event.userData.st,
          country: event.userData.country,
          client_ip_address: event.userData.client_ip_address,
          client_user_agent: event.userData.client_user_agent,
          fbc: event.userData.fbc,
          fbp: event.userData.fbp,
        },
        custom_data: event.customData ? {
          currency: event.customData.currency,
          value: event.customData.value,
          content_ids: event.customData.contentIds,
          content_type: event.customData.contentType,
        } : undefined,
        event_id: event.eventId,
      }],
      access_token: accessToken,
      ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
    };
    try {
      const { data } = await firstValueFrom(
        this.http.post<any>(
          `https://graph.facebook.com/${version}/${pixelId}/events`,
          payload,
          { timeout: 15000 },
        ),
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Meta CAPI failed: ${message}`);
      if (error && typeof error === 'object' && 'response' in error) throw error;
      throw new BadGatewayException(`Meta Conversions API rejected the event: ${message}`);
    }
  }

  async sendServerEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    const hashed = {
      ...event.userData,
      em: event.userData.em?.map(e => createHash('sha256').update(e.trim().toLowerCase()).digest('hex')),
      ph: event.userData.ph?.map(p => createHash('sha256').update(normalizePhoneForMeta(p)).digest('hex')),
      fn: event.userData.fn?.map(f => createHash('sha256').update(f.trim().toLowerCase()).digest('hex')),
      ln: event.userData.ln?.map(l => createHash('sha256').update(l.trim().toLowerCase()).digest('hex')),
      externalId: event.userData.externalId?.map(id => createHash('sha256').update(id).digest('hex')),
      // ct/st/country ya llegan normalizados desde geo-inference (minúsculas,
      // sin acentos ni espacios), que es el formato que Meta exige antes de
      // hashear. Se aplica normalizeGeoValue igualmente por si el valor viene
      // de otra fuente.
      ct: event.userData.ct?.map(c => createHash('sha256').update(normalizeGeoValue(c)).digest('hex')),
      st: event.userData.st?.map(s => createHash('sha256').update(normalizeGeoValue(s)).digest('hex')),
      country: event.userData.country?.map(c => createHash('sha256').update(normalizeGeoValue(c)).digest('hex')),
    };
    return this.sendEvent(pixelId, accessToken, { ...event, userData: hashed });
  }
}

/**
 * Meta exige que `ph` incluya el código de país, sin ceros a la izquierda, sin
 * símbolos, solo dígitos (ver la documentación de Customer Information
 * Parameters). Los números chilenos locales se guardan como 9 dígitos (ej.
 * 912345678) sin código de país, lo que rompe silenciosamente el matching de
 * teléfono si se hashea tal cual. Se antepone el código de país por defecto
 * cuando el número todavía no parece tener formato internacional.
 */
function normalizePhoneForMeta(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const defaultCountryCode = process.env.META_PHONE_DEFAULT_COUNTRY_CODE ?? '56';
  if (digits.startsWith(defaultCountryCode) && digits.length > 9) return digits;
  if (digits.length > 9) return digits; // already looks internationally formatted
  return `${defaultCountryCode}${digits.replace(/^0+/, '')}`;
}
