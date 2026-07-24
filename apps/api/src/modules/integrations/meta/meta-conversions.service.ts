import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'node:crypto';
import { BadGatewayException } from '@nestjs/common';

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
  };
  customData?: {
    currency?: string;
    value?: number;
    contentIds?: string[];
    contentType?: string;
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
    };
    return this.sendEvent(pixelId, accessToken, { ...event, userData: hashed });
  }
}

/**
 * Meta requires `ph` to include the country code with no leading zeros, no
 * symbols, digits only (see Customer Information Parameters docs). Local
 * Chilean numbers are stored as 9 digits (e.g. 912345678) without a country
 * code, which silently breaks phone matching if hashed as-is. Prepend the
 * default country code when the number doesn't already look internationally
 * formatted.
 */
function normalizePhoneForMeta(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const defaultCountryCode = process.env.META_PHONE_DEFAULT_COUNTRY_CODE ?? '56';
  if (digits.startsWith(defaultCountryCode) && digits.length > 9) return digits;
  if (digits.length > 9) return digits; // already looks internationally formatted
  return `${defaultCountryCode}${digits.replace(/^0+/, '')}`;
}
