import { Injectable, UnauthorizedException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { createHmac, timingSafeEqual } from "node:crypto";
import { firstValueFrom } from "rxjs";

type MetaPayload = {
  object?: string;
  entry?: Array<{
    id: string;
    time?: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{ type: string; payload?: { url?: string } }>;
      };
    }>;
  }>;
};

export interface InboundMessage {
  eventId: string;
  providerMessageId: string;
  tenantId: string;
  channel: string;
  channelAccountId: string;
  externalUserId: string;
  text?: string;
  attachments?: Array<{ type: string; url?: string }>;
  occurredAt: string;
}

export function verifyMetaSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(signature.slice(7), "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

@Injectable()
export class MetaService {
  constructor(private readonly http: HttpService) {}

  verify(rawBody: Buffer, signature: string) {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !verifyMetaSignature(rawBody, signature, secret))
      throw new UnauthorizedException("Invalid Meta signature");
  }

  normalize(payload: MetaPayload): InboundMessage[] {
    const result: InboundMessage[] = [];
    for (const entry of payload.entry ?? []) {
      for (const item of entry.messaging ?? []) {
        if (item.message) {
          const tenantId = process.env[`META_TENANT_${entry.id}`] ?? process.env.DEFAULT_TENANT_ID;
          if (!tenantId) continue;
          result.push({
            eventId: item.message.mid,
            providerMessageId: item.message.mid,
            tenantId,
            channel: "instagram",
            channelAccountId: entry.id,
            externalUserId: item.sender.id,
            text: item.message.text,
            attachments: (item.message.attachments ?? []).map((a) => ({
              type: ["image", "video", "audio", "file"].includes(a.type) ? (a.type as "image") : "unknown",
              url: a.payload?.url,
            })),
            occurredAt: new Date(item.timestamp).toISOString(),
          });
        }
      }
    }
    return result;
  }

  async dispatch(messages: InboundMessage[]) {
    const baseUrl = process.env.CONVERSATION_SERVICE_URL?.replace(/\/$/, '');
    if (!baseUrl) {
      return messages.map(() => ({ skipped: true, reason: 'conversation_service_not_configured' }));
    }
    return Promise.all(
      messages.map(async (message) => {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (process.env.INTERNAL_API_TOKEN) headers["x-internal-token"] = process.env.INTERNAL_API_TOKEN;
        const reply = (await firstValueFrom(
          this.http.post<{ text?: string }>(`${baseUrl}/internal/messages/inbound`, message, { headers }),
        )).data;
        if (reply.text) await this.sendInstagramText(message.channelAccountId, message.externalUserId, reply.text);
        return reply;
      }),
    );
  }

  private async sendInstagramText(accountId: string, recipientId: string, text: string) {
    const token = process.env[`META_TOKEN_${accountId}`] ?? process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) return { skipped: true, reason: "missing_page_token" };
    const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
    const { data } = await firstValueFrom(
      this.http.post<any>(
        `https://graph.facebook.com/${version}/${accountId}/messages`,
        { recipient: { id: recipientId }, message: { text } },
        { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } },
      ),
    );
    return data;
  }

  async refreshToken(accountId: string): Promise<boolean> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const currentToken = process.env[`META_TOKEN_${accountId}`] ?? process.env.META_PAGE_ACCESS_TOKEN;
    if (!appId || !appSecret || !currentToken) return false;
    try {
      const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
      const { data } = await firstValueFrom(
        this.http.get<any>(`https://graph.facebook.com/${version}/oauth/access_token`, {
          params: {
            grant_type: "fb_exchange_token",
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: currentToken,
          },
        }),
      );
      return !!data.access_token;
    } catch {
      return false;
    }
  }
}
