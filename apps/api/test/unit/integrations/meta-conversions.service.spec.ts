import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaConversionsService } from '../../../src/modules/integrations/meta/meta-conversions.service';

describe('MetaConversionsService', () => {
  const originalTestCode = process.env.META_TEST_EVENT_CODE;

  afterEach(() => {
    if (originalTestCode === undefined) delete process.env.META_TEST_EVENT_CODE;
    else process.env.META_TEST_EVENT_CODE = originalTestCode;
  });

  it('maps CRM fields to the Meta CAPI contract and hashes identifiers', async () => {
    process.env.META_TEST_EVENT_CODE = 'TEST123';
    const post = vi.fn().mockReturnValue(of({ data: { events_received: 1 } }));
    const service = new MetaConversionsService({ post } as any);

    await service.sendServerEvent('pixel-1', 'server-token', {
      eventName: 'Lead',
      eventTime: 1700000000,
      actionSource: 'system_generated',
      userData: { em: [' Person@Example.com '] },
      eventId: 'event-1',
    });

    const payload = post.mock.calls[0][1];
    expect(payload.test_event_code).toBe('TEST123');
    expect(payload.data[0]).toEqual(expect.objectContaining({
      event_name: 'Lead',
      event_time: 1700000000,
      action_source: 'system_generated',
      event_id: 'event-1',
    }));
    expect(payload.data[0].user_data.em[0]).not.toContain('Person@Example.com');
  });
});
