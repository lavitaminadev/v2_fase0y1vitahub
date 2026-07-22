import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportingController } from '../../../src/modules/reports/reports.controller';

const dataSource = {
  query: vi.fn(),
};
const pulseService = { getPulse: vi.fn() };
const accountAccess = { allowedClientIds: vi.fn() };

describe('ReportingController', () => {
  let controller: ReportingController;

  beforeEach(() => {
    vi.clearAllMocks();
    accountAccess.allowedClientIds.mockImplementation(async (_organizationId: string, user: any) => (
      user.role === 'client' ? [user.clientId] : undefined
    ));
    controller = new ReportingController(dataSource as any, pulseService as any, accountAccess as any);
  });

  it('uses the real invoices table instead of billing_invoices for aggregate reports', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 1000 }])
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([{ avg: 12 }])
      .mockResolvedValueOnce([{ month: '2026-07', revenue: 1000, ud: 5 }])
      .mockResolvedValueOnce([{ name: 'Cliente Uno', revenue: 1000 }]);

    const result = await controller.reports({
      organizationId: 'org-1',
      user: { role: 'admin' },
    } as any);

    expect(dataSource.query.mock.calls[0][0]).toContain('FROM invoices');
    expect(dataSource.query.mock.calls[0][0]).not.toContain('billing_invoices');
    expect(result.totalRevenue).toBe(1000);
    expect(result.monthlyData).toEqual([{ month: '2026-07', revenue: 1000, ud: 5 }]);
    expect(result.topClients).toEqual([{ name: 'Cliente Uno', revenue: 1000 }]);
  });

  it('reads XP from the migrated points column', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ status: 'in_progress', count: 3 }])
      .mockResolvedValueOnce([{ total: 180 }])
      .mockResolvedValueOnce([{ contracted: 64, consumed: 31.1, reserved: 4.8 }]);

    const result = await controller.dashboard({
      organizationId: 'org-1',
      user: { id: 'admin-1', role: 'admin' },
    } as any);

    expect(dataSource.query.mock.calls[2][0]).toContain('SUM(points)');
    expect(dataSource.query.mock.calls[2][0]).not.toContain('SUM(amount)');
    expect(result.teamXp).toBe(180);
  });

  it('scopes client portal reports to the authenticated client id', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 2500 }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ avg: 20 }])
      .mockResolvedValueOnce([{ month: '2026-07', revenue: 2500, ud: 8 }])
      .mockResolvedValueOnce([{ name: 'Cliente Portal', revenue: 2500 }]);

    await controller.reports({
      organizationId: 'org-1',
      user: { role: 'client', clientId: 'client-1' },
    } as any);

    expect(dataSource.query.mock.calls[0][0]).toContain('client_id = ?');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['org-1', 'client-1']);
    expect(dataSource.query.mock.calls[4][1]).toEqual(['org-1', 'client-1']);
  });

  it('returns strategic metrics without invented targets', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 12000 }])
      .mockResolvedValueOnce([{ total: 7 }])
      .mockResolvedValueOnce([{ total: 140 }])
      .mockResolvedValueOnce([{ pct: 90 }]);

    const result = await controller.kpi({
      organizationId: 'org-1',
      user: { role: 'admin' },
    } as any);

    expect(result.revenueTarget).toBeNull();
    expect(result.clientTarget).toBeNull();
    expect(result.udTarget).toBeNull();
    expect(result.utilizationTarget).toBeNull();
    expect(result.teamUtilization).toBeNull();
    expect(result.nps).toBeNull();
    expect(result.growthRate).toBeNull();
  });

  it('scopes community manager reports to assigned clients', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-1', 'client-2']);
    dataSource.query
      .mockResolvedValueOnce([{ total: 1000 }])
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([{ avg: 12 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await controller.reports({
      organizationId: 'org-1',
      user: { id: 'cm-1', role: 'community_manager' },
    } as any);

    expect(dataSource.query.mock.calls[0][0]).toContain('client_id IN (?,?)');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['org-1', 'client-1', 'client-2']);
    expect(dataSource.query.mock.calls[4][0]).toContain('c.id IN (?,?)');
    expect(dataSource.query.mock.calls[4][1]).toEqual(['org-1', 'client-1', 'client-2']);
  });
});
