import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientOverviewService } from '../../../src/modules/clients/client-overview.service';

/**
 * El resumen del cliente agrega las piezas por estado dentro de un JSON.
 *
 * MySQL/MariaDB rechaza anidar una funcion de agregacion dentro de otra (error 1111,
 * "Invalid use of group function"), asi que el conteo por estado tiene que resolverse en
 * una tabla derivada antes de envolverlo con JSON_ARRAYAGG.
 */
describe('ClientOverviewService', () => {
  const client = { id: 'client-1', organizationId: 'org-1', name: 'Acme' };
  let clients: { findOne: ReturnType<typeof vi.fn> };
  let dataSource: { query: ReturnType<typeof vi.fn> };

  function buildService(pieceData: string) {
    clients = { findOne: vi.fn().mockResolvedValue(client) };
    dataSource = {
      query: vi.fn()
        .mockResolvedValueOnce([{
          piece_data: pieceData,
          ud_data: JSON.stringify({ contracted: 10, reserved: 4, consumed: 2 }),
          content_grids: 3, meetings_total: 2, upcoming_meetings: 1, documents: 5,
          forms_total: 2, forms_published: 1, contracts_total: 1, contracts_active: 1,
          briefs_total: 4, briefs_approved: 2,
        }])
        .mockResolvedValue([]),
    };
    return new ClientOverviewService(clients as never, dataSource as never);
  }

  beforeEach(() => vi.clearAllMocks());

  it('agrega el conteo por estado en una tabla derivada, no dentro de JSON_ARRAYAGG', async () => {
    const service = buildService(JSON.stringify({ pieces: [{ status: 'backlog', total: 1 }] }));
    await service.getOverview('client-1', 'org-1');

    const sql: string = dataSource.query.mock.calls[0][0];
    const normalized = sql.replace(/\s+/g, ' ');
    expect(normalized).toContain('SELECT status, COUNT(*) AS total');
    expect(normalized).toContain(') AS grouped');
    // COUNT(*) nunca puede quedar dentro del JSON_OBJECT que envuelve JSON_ARRAYAGG.
    expect(normalized).not.toMatch(/JSON_ARRAYAGG\(JSON_OBJECT\([^)]*COUNT\(\*\)/);
  });

  it('suma como pendientes las piezas que no estan entregadas ni canceladas', async () => {
    const service = buildService(JSON.stringify({
      pieces: [
        { status: 'backlog', total: 1 },
        { status: 'in_progress', total: 2 },
        { status: 'delivered', total: 4 },
        { status: 'cancelled', total: 3 },
      ],
    }));

    const result = await service.getOverview('client-1', 'org-1');

    expect(result.stats.pendingPieces).toBe(3);
    expect(result.pieceStatuses).toHaveLength(4);
  });

  it('trata un cliente sin piezas como cero pendientes', async () => {
    // Sin filas agrupadas, JSON_ARRAYAGG devuelve NULL y el JSON queda {"pieces": null}.
    const service = buildService(JSON.stringify({ pieces: null }));

    const result = await service.getOverview('client-1', 'org-1');

    expect(result.stats.pendingPieces).toBe(0);
    expect(result.pieceStatuses).toEqual([]);
  });
});
