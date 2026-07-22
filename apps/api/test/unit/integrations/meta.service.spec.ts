import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaService, type InboundMessage } from '../../../src/modules/integrations/meta/meta.service';

describe('MetaService optional messaging', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not call an undeclared local conversation service', async () => {
    vi.stubEnv('CONVERSATION_SERVICE_URL', '');
    const http = { post: vi.fn() };
    const service = new MetaService(http as never);
    const message: InboundMessage = {
      eventId: 'message-1',
      providerMessageId: 'message-1',
      tenantId: 'org-1',
      channel: 'instagram',
      channelAccountId: 'page-1',
      externalUserId: 'user-1',
      text: 'Hola',
      occurredAt: new Date().toISOString(),
    };

    await expect(service.dispatch([message])).resolves.toEqual([
      { skipped: true, reason: 'conversation_service_not_configured' },
    ]);
    expect(http.post).not.toHaveBeenCalled();
  });
});
