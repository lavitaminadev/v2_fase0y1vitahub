import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurgeExpiredLeadsJob } from '../../../src/core/jobs/cron/purge-expired-leads.job';

const leadRepo = {
  find: vi.fn(),
};

const dataProtection = {
  anonymizeLead: vi.fn(),
};

describe('PurgeExpiredLeadsJob', () => {
  let job: PurgeExpiredLeadsJob;

  beforeEach(() => {
    vi.clearAllMocks();
    job = new PurgeExpiredLeadsJob(leadRepo as any, dataProtection as any);
  });

  it('anonymizes discarded leads whose retention date has expired', async () => {
    leadRepo.find.mockResolvedValue([
      {
        id: 'lead-1',
        organizationId: 'org-1',
        fitStatus: 'discarded',
        retentionReviewAt: new Date('2026-07-01T00:00:00.000Z'),
        metadata: {},
      },
    ]);

    await job.handle();

    expect(dataProtection.anonymizeLead).toHaveBeenCalledWith('lead-1', 'org-1', 'Retención expirada');
  });

  it('skips leads that were already anonymized', async () => {
    leadRepo.find.mockResolvedValue([
      {
        id: 'lead-2',
        organizationId: 'org-1',
        fitStatus: 'discarded',
        retentionReviewAt: new Date('2026-07-01T00:00:00.000Z'),
        metadata: { retentionAnonymizedAt: '2026-07-02T00:00:00.000Z' },
      },
    ]);

    await job.handle();

    expect(dataProtection.anonymizeLead).not.toHaveBeenCalled();
  });
});
