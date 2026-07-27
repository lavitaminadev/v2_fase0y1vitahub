import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantMiddleware } from '../../../src/core/tenancy/tenant.middleware';
import { tenantContext } from '../../../src/core/tenancy/tenant-context';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let mockReq: any;
  let mockRes: any;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    middleware = new TenantMiddleware();
    mockReq = { path: '/some/protected', headers: {}, user: null };
    mockRes = {};
    nextFn = vi.fn();
  });

  it('should skip tenancy for public routes', () => {
    mockReq.path = '/auth/login';

    middleware.use(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.organizationId).toBeUndefined();
  });

  it('should extract org from x-organization-id header', () => {
    mockReq.headers['x-organization-id'] = 'org-123';

    middleware.use(mockReq, mockRes, nextFn);

    expect(mockReq.organizationId).toBe('org-123');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should extract org from JWT user', () => {
    mockReq.user = { organizationId: 'org-from-jwt' };

    middleware.use(mockReq, mockRes, nextFn);

    expect(mockReq.organizationId).toBe('org-from-jwt');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should prefer header org over JWT org', () => {
    mockReq.headers['x-organization-id'] = 'org-from-header';
    mockReq.user = { organizationId: 'org-from-jwt' };

    middleware.use(mockReq, mockRes, nextFn);

    expect(mockReq.organizationId).toBe('org-from-header');
  });

  it('should call next() even when no org is found', () => {
    nextFn.mockImplementation(() => {
      expect(tenantContext.getStore()).toEqual({ organizationId: undefined });
    });

    middleware.use(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.organizationId).toBeUndefined();
  });
});
