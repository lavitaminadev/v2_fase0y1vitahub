import { describe, expect, it, vi } from 'vitest';
import { GetOperationsOverviewUseCase } from '../../../src/modules/operations/get-operations-overview.use-case';

describe('GetOperationsOverviewUseCase', () => {
  it('returns team capacity and configured pods', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValueOnce([
        { id: 'u-1', name: 'Ana', role: 'designer', currentPieces: '2', currentLoad: '8.5', capacity: 0 },
        { id: 'u-2', name: 'Leo', role: 'audiovisual', currentPieces: '1', currentLoad: '5', capacity: 0 },
      ]).mockResolvedValueOnce([]),
    };
    const useCase = new GetOperationsOverviewUseCase(dataSource as never);

    const result = await useCase.execute('org-1');

    expect(result.team).toHaveLength(2);
    expect(result.usedCapacity).toBe(13.5);
    expect(result.pods).toEqual([]);
    expect(dataSource.query.mock.calls[1][0]).toContain('FROM pods');
  });
});
