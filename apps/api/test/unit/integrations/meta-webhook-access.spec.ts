import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import { SKIP_TENANCY_KEY } from '../../../src/core/tenancy/skip-tenancy.decorator';
import { MetaController } from '../../../src/modules/integrations/meta/meta.controller';

describe('Meta webhook access boundary', () => {
  it('allows Meta callbacks through auth and tenant guards for signature verification', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MetaController)).toBe(true);
    expect(Reflect.getMetadata(SKIP_TENANCY_KEY, MetaController)).toBe(true);
  });
});
