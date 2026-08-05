import { describe, expect, it, vi } from 'vitest';
import { OrganizationContextGuard } from '../../../src/core/organization/organization-context.guard';
import { OrganizationContextMiddleware } from '../../../src/core/organization/organization-context.middleware';
import { organizationContext } from '../../../src/core/organization/organization-context';

function executionContext(request: Record<string, unknown>) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('OrganizationContextGuard', () => {
  it('toma la organización del usuario autenticado', () => {
    const request = { user: { id: 'user-1', role: 'admin', organizationId: 'org-1' } } as any;

    organizationContext.run({}, () => {
      expect(new OrganizationContextGuard().canActivate(executionContext(request))).toBe(true);
      expect(request.organizationId).toBe('org-1');
      expect(organizationContext.getStore()?.organizationId).toBe('org-1');
    });
  });

  it('ignora la organización que llega en la cabecera', () => {
    // VITAHUB opera una sola organizacion y quien la indica es el JWT. Aceptar un valor de
    // la peticion permitiria a un cliente elegir en que organizacion lee y escribe.
    const request = {
      headers: { 'x-organization-id': 'org-ajena' },
      organizationId: 'org-ajena',
      user: { id: 'user-1', role: 'admin', organizationId: 'org-propia' },
    } as any;

    organizationContext.run({}, () => {
      new OrganizationContextGuard().canActivate(executionContext(request));
      expect(request.organizationId).toBe('org-propia');
      expect(organizationContext.getStore()?.organizationId).toBe('org-propia');
    });
  });

  it('deja la organización sin resolver cuando la ruta no tiene usuario', () => {
    const request = { headers: { 'x-organization-id': 'org-ajena' } } as any;

    organizationContext.run({}, () => {
      expect(new OrganizationContextGuard().canActivate(executionContext(request))).toBe(true);
      expect(request.organizationId).toBeUndefined();
      expect(organizationContext.getStore()?.organizationId).toBeUndefined();
    });
  });
});

describe('OrganizationContextMiddleware', () => {
  it('abre el contexto vacío para que lo llene el guard', () => {
    const next = vi.fn(() => {
      expect(organizationContext.getStore()).toEqual({});
    });

    new OrganizationContextMiddleware().use({ headers: { 'x-organization-id': 'org-ajena' } } as any, {} as any, next);

    expect(next).toHaveBeenCalled();
  });
});
