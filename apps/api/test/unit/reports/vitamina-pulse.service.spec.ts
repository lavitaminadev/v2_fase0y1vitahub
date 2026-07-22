import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VitaminaPulseService } from '../../../src/modules/reports/vitamina-pulse.service';

const dataSource = { query: vi.fn() };

function arrange(rows: unknown[][]) {
  rows.forEach((result) => dataSource.query.mockResolvedValueOnce(result));
}

describe('VitaminaPulseService', () => {
  let service: VitaminaPulseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VitaminaPulseService(dataSource as any);
  });

  it('excludes dimensions without evidence instead of treating them as zero', async () => {
    arrange([
      [{ total: 0, grids_completed: 0, meetings_completed: 0, meetings_due: 0 }],
      [{ total: 4, delivered: 4, pending: 0, overdue: 0, delivered_recent: 4 }],
      [{ total: 0, pending: 0, approved: 0, overdue: 0 }],
      [{ total: 0, completed: 0, upcoming: 0 }],
      [{ total: 0, leads: 0, conversions: 0, last_data_at: null }],
      [{ total: 0, attended: 0, no_show: 0, cancelled: 0 }],
      [{ total: 1, active: 1, oldest_start: '2026-01-01' }],
      [],
    ]);

    const pulse = await service.getPulse('org-1');

    expect(pulse.score).toBe(100);
    expect(pulse.coverage).toBe(20);
    expect(pulse.dimensions.find((item) => item.key === 'measurement')?.score).toBeNull();
  });

  it('turns overdue work into explicit high-priority actions', async () => {
    arrange([
      [{ total: 1, grids_completed: 0, meetings_completed: 1, meetings_due: 4 }],
      [{ total: 5, delivered: 1, pending: 4, overdue: 2, delivered_recent: 1 }],
      [{ total: 3, pending: 2, approved: 1, overdue: 1 }],
      [{ total: 1, completed: 1, upcoming: 0 }],
      [{ total: 2, leads: 10, conversions: 1, last_data_at: '2026-07-17' }],
      [{ total: 10, attended: 7, no_show: 1, cancelled: 1 }],
      [{ total: 1, active: 1, oldest_start: '2026-01-01' }],
      [],
    ]);

    const pulse = await service.getPulse('org-1', 'client-1');

    expect(pulse.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'overdue-pieces', priority: 'high', owner: 'team' }),
      expect.objectContaining({ id: 'overdue-approvals', priority: 'high', owner: 'client' }),
    ]));
    expect(dataSource.query.mock.calls[0][0]).toContain('client_id = ?');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['org-1', 'client-1']);
  });
});
