import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TenantGuard } from '../../../src/core/tenancy/tenant.guard';
import { SKIP_TENANCY_KEY } from '../../../src/core/tenancy/skip-tenancy.decorator';
import { tenantContext } from '../../../src/core/tenancy/tenant-context';

function executionContext(request: Record<string, unknown>) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('TenantGuard', () => {
  it('denies cross-organization access to administrators', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new TenantGuard(reflector as any);
    const context = executionContext({
      organizationId: 'org-target',
      user: { id: 'admin-1', role: 'admin', organizationId: 'org-admin' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access within the authenticated organization', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new TenantGuard(reflector as any);
    const context = executionContext({
      organizationId: 'org-1',
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('fills the validated organization after Passport authenticates the request', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new TenantGuard(reflector as any);
    const request = {
      user: { id: 'user-1', role: 'admin', organizationId: 'org-1' },
    } as any;
    const context = executionContext(request);

    tenantContext.run({}, () => {
      expect(guard.canActivate(context)).toBe(true);
      expect(request.organizationId).toBe('org-1');
      expect(tenantContext.getStore()?.organizationId).toBe('org-1');
    });
  });

  it('only bypasses tenancy when the route opts out explicitly', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => key === SKIP_TENANCY_KEY),
    };
    const guard = new TenantGuard(reflector as any);
    const context = executionContext({});

    expect(guard.canActivate(context)).toBe(true);
  });
});
