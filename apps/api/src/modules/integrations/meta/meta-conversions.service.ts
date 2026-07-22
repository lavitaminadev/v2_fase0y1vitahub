import { Injectable } from '@nestjs/common';
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
    } catch {
      throw new BadGatewayException('Meta Conversions API rejected the event');
    }
  }

  async sendServerEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    const hashed = {
      ...event.userData,
      em: event.userData.em?.map(e => createHash('sha256').update(e.trim().toLowerCase()).digest('hex')),
      ph: event.userData.ph?.map(p => createHash('sha256').update(p.replace(/\D/g, '')).digest('hex')),
      externalId: event.userData.externalId?.map(id => createHash('sha256').update(id).digest('hex')),
    };
    return this.sendEvent(pixelId, accessToken, { ...event, userData: hashed });
  }
}
