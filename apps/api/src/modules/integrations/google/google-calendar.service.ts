import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';
import { GoogleOAuthService } from './google-oauth.service';

interface CalendarEventInput { summary: string; description?: string; start: Date; durationMinutes: number }

@Injectable()
export class GoogleCalendarService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    private readonly oauth: GoogleOAuthService,
  ) {}

  async createEvent(organizationId: string, event: CalendarEventInput) {
    let integration = await this.integrations.findOne({ where: { organizationId, provider: IntegrationProvider.GOOGLE } });
    if (!integration) throw new BadRequestException('Google is not connected');
    integration = await this.refreshIfExpiring(integration, organizationId);
    let token = this.revealAccessToken(integration);
    let response = await this.sendEvent(token, event);

    // Access tokens can be revoked before their advertised expiry; retry once after refresh.
    if (response.status === 401) {
      integration = await this.oauth.refreshIntegration(integration.id, organizationId);
      token = this.revealAccessToken(integration);
      response = await this.sendEvent(token, event);
    }

    const data = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } };
    if (!response.ok) throw new BadRequestException(data.error?.message ?? 'Google Calendar event creation failed');
    return { externalId: data.id, calendarUrl: data.htmlLink, meetingLink: data.hangoutLink };
  }

  private async refreshIfExpiring(integration: Integration, organizationId: string): Promise<Integration> {
    const expiry = typeof integration.config?.expiryDate === 'string' ? new Date(integration.config.expiryDate).getTime() : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) return this.oauth.refreshIntegration(integration.id, organizationId);
    return integration;
  }

  private revealAccessToken(integration: Integration): string {
    const token = revealSecret(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    if (!token) throw new BadRequestException('Google access token is unavailable');
    return token;
  }

  private sendEvent(token: string, event: CalendarEventInput): Promise<Response> {
    const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
    return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ summary: event.summary, description: event.description, start: { dateTime: event.start.toISOString() }, end: { dateTime: end.toISOString() }, conferenceData: { createRequest: { requestId: `vitahub-${crypto.randomUUID()}` } } }),
    });
  }
}
