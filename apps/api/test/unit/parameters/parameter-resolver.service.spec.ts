import { describe, expect, it, vi } from 'vitest';
import { ParameterResolver } from '../../../src/core/parameters/parameter-resolver.service';

describe('ParameterResolver tenant cache', () => {
  it('keeps organization values isolated in cache', async () => {
    const definitionRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'definition-1', key: 'production.stale_hours', defaultValue: { value: 48 } }),
    };
    const valueRepo = {
      findOne: vi.fn().mockImplementation(async ({ where }: { where: Array<{ scopeId: string }> }) => ({
        valueJson: { value: where[0].scopeId === 'org-1' ? 24 : 72 },
      })),
    };
    const resolver = new ParameterResolver(definitionRepo as any, valueRepo as any);

    await expect(resolver.get('production.stale_hours', null, null, 'org-1')).resolves.toBe(24);
    await expect(resolver.get('production.stale_hours', null, null, 'org-2')).resolves.toBe(72);
    expect(valueRepo.findOne).toHaveBeenCalledTimes(2);
  });
});
