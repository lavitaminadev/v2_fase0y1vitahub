import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionResolverService } from '../../../src/core/authorization/permission-resolver.service';
import { PERMISSION_LEVELS, satisfies } from '../../../src/core/authorization/permission-level';
import { roleLevel } from '../../../src/core/authorization/role-permissions';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function makeResolver(features: Record<string, boolean> | null, overrides: unknown[] = []) {
  const organizations = { findOne: vi.fn().mockResolvedValue({ id: 'org-1', features }) };
  const overrideRepo = { find: vi.fn().mockResolvedValue(overrides) };
  return {
    resolver: new PermissionResolverService(organizations as never, overrideRepo as never),
    organizations,
    overrideRepo,
  };
}

describe('satisfies', () => {
  it('acepta niveles superiores al requerido', () => {
    expect(satisfies('manage', 'view')).toBe(true);
    expect(satisfies('edit', 'edit')).toBe(true);
    expect(satisfies('view', 'edit')).toBe(false);
    expect(satisfies('none', 'view')).toBe(false);
  });

  it('mantiene los niveles ordenados de menor a mayor', () => {
    expect([...PERMISSION_LEVELS]).toEqual(['none', 'view', 'edit', 'manage']);
  });
});

describe('roleLevel', () => {
  it('otorga administración total al rol admin', () => {
    expect(roleLevel(UserRole.ADMIN, 'billing')).toBe('manage');
    expect(roleLevel(UserRole.ADMIN, 'clientMetricsPanel')).toBe('manage');
  });

  it('devuelve none para un módulo ausente en el mapa del rol', () => {
    expect(roleLevel(UserRole.DESIGNER, 'billing')).toBe('none');
  });

  it('da al community manager edición de reservas y CRM, sin facturación', () => {
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'reservations')).toBe('edit');
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'crm')).toBe('edit');
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'billing')).toBe('none');
  });
});

describe('PermissionResolverService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resuelve el nivel del cargo cuando el módulo está habilitado', async () => {
    const { resolver } = makeResolver({ reservations: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMUNITY_MANAGER);
    expect(permissions.reservations).toBe('edit');
  });

  it('devuelve none en un módulo deshabilitado, incluso para admin', async () => {
    const { resolver } = makeResolver({ billing: false });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.billing).toBe('none');
  });

  it('deja los módulos de fases futuras en none por defecto', async () => {
    const { resolver } = makeResolver(null);
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.clientMetricsPanel).toBe('none');
    expect(permissions.production).toBe('none');
    expect(permissions.reservations).toBe('manage');
  });

  it('la excepción del usuario reemplaza el nivel del cargo', async () => {
    const { resolver } = makeResolver(
      { reports: true },
      [{ module: 'reports', level: 'manage' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.DESIGNER);
    expect(permissions.reports).toBe('manage');
  });

  it('la excepción none deniega lo que el cargo concede', async () => {
    const { resolver } = makeResolver(
      { reservations: true },
      [{ module: 'reservations', level: 'none' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMUNITY_MANAGER);
    expect(permissions.reservations).toBe('none');
  });

  it('el módulo deshabilitado prevalece sobre una excepción que concede acceso', async () => {
    const { resolver } = makeResolver(
      { production: false },
      [{ module: 'production', level: 'manage' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.DESIGNER);
    expect(permissions.production).toBe('none');
  });

  it('can compara contra el nivel exigido', async () => {
    const { resolver } = makeResolver({ reservations: true });
    await expect(resolver.can('org-1', 'user-1', UserRole.COMMUNITY_MANAGER, 'reservations', 'view')).resolves.toBe(true);
    await expect(resolver.can('org-1', 'user-1', UserRole.COMMUNITY_MANAGER, 'reservations', 'manage')).resolves.toBe(false);
  });

  it('can niega un módulo desconocido', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await expect(resolver.can('org-1', 'user-1', UserRole.ADMIN, 'inventado', 'view')).resolves.toBe(false);
    expect(organizations.findOne).not.toHaveBeenCalled();
  });

  it('explain distingue lo heredado del cargo de la excepción', async () => {
    const { resolver } = makeResolver(
      { reports: true, reservations: true, production: false },
      [{ module: 'reports', level: 'manage' }],
    );
    const modules = await resolver.explain('org-1', 'user-1', UserRole.DESIGNER);
    const byModule = new Map(modules.map((item) => [item.module, item]));
    expect(byModule.get('reports')).toMatchObject({ level: 'manage', source: 'override', moduleDisabled: false });
    expect(byModule.get('reservations')).toMatchObject({ source: 'role' });
    expect(byModule.get('production')).toMatchObject({ level: 'none', moduleDisabled: true });
  });

  it('memoriza y relee después de invalidar el usuario', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(1);
    resolver.invalidateUser('user-1');
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidar la organización afecta a todos sus usuarios', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-2', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(2);
    resolver.invalidateOrganization('org-1');
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-2', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(4);
  });
});
