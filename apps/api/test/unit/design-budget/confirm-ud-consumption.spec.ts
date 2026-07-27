import { describe, expect, it, vi } from 'vitest';
import { ConfirmUdConsumptionUseCase } from '../../../src/modules/design-budget/confirm-ud-consumption.use-case';
import { UDMovementType } from '../../../src/modules/design-budget/ud-movement-type.enum';

describe('ConfirmUdConsumptionUseCase', () => {
  it('consumes only the reservation associated with the selected piece', async () => {
    const budget = { id: 'budget-1', clientId: 'client-1', reserved: 12, consumed: 3 };
    const findOne = vi.fn()
      .mockResolvedValueOnce({ id: 'piece-1', organizationId: 'org-1', clientId: 'client-1' })
      .mockResolvedValueOnce(budget)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'reservation-1', udBudgetId: 'budget-1', pieceId: 'piece-1', amount: 5 });
    const manager = {
      findOne,
      create: vi.fn((_entity, data) => data),
      save: vi.fn(async (_entity, data) => data),
    };
    const budgetRepo = { manager: { transaction: vi.fn(async (work) => work(manager)) } };
    const useCase = new ConfirmUdConsumptionUseCase(budgetRepo as never, {} as never);

    const result = await useCase.execute('org-1', 'client-1', 'piece-1', 2026, 7);

    expect(result.reserved).toBe(7);
    expect(result.consumed).toBe(8);
    expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      pieceId: 'piece-1',
      type: UDMovementType.CONSUMPTION,
      amount: 5,
    }));
  });
});
