import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../../src/core/authorization/feature.guard';
import { REQUIRES_FEATURE_KEY } from '../../../src/core/authorization/requires-feature.decorator';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import {
  DEFAULT_ORGANIZATION_FEATURES, ORGANIZATION_FEATURE_KEYS, normalizeOrganizationFeatures,
} from '../../../src/modules/organizations/organization-features';

function makeContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as never;
}

function makeGuard(metadata: Record<string, unknown>, organization: unknown) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => metadata[key]),
  };
  const organizations = { findOne: vi.fn().mockResolvedValue(organization) };
  return { guard: new FeatureGuard(reflector as never, organizations as never), organizations, reflector };
}

describe('FeatureGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deja pasar cuando el endpoint no exige ningún módulo', async () => {
    const { guard, organizations } = makeGuard({}, null);
    await expect(guard.canActivate(makeContext({ organizationId: 'org-1' }))).resolves.toBe(true);
    // No debe consultar la base cuando no hay nada que comprobar.
    expect(organizations.findOne).not.toHaveBeenCalled();
  });

  it('deja pasar los endpoints públicos', async () => {
    const { guard } = makeGuard({ [IS_PUBLIC_KEY]: true, [REQUIRES_FEATURE_KEY]: 'production' }, null);
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
  });

  it('deja pasar cuando el módulo está habilitado', async () => {
    const { guard } = makeGuard(
      { [REQUIRES_FEATURE_KEY]: 'reservations' },
      { id: 'org-1', features: { reservations: true } },
    );
    await expect(guard.canActivate(makeContext({ organizationId: 'org-1' }))).resolves.toBe(true);
  });

  it('rechaza cuando el módulo está apagado', async () => {
    const { guard } = makeGuard(
      { [REQUIRES_FEATURE_KEY]: 'production' },
      { id: 'org-1', features: { production: false } },
    );
    await expect(guard.canActivate(makeContext({ organizationId: 'org-1' })))
      .rejects.toThrow('Este módulo no está habilitado');
  });

  it('rechaza los módulos de fases futuras por defecto', async () => {
    const { guard } = makeGuard({ [REQUIRES_FEATURE_KEY]: 'clientMetricsPanel' }, { id: 'org-1', features: null });
    await expect(guard.canActivate(makeContext({ organizationId: 'org-1' })))
      .rejects.toThrow('Este módulo no está habilitado');
  });

  it('niega cuando no se puede determinar la organización', async () => {
    const { guard } = makeGuard({ [REQUIRES_FEATURE_KEY]: 'reservations' }, null);
    await expect(guard.canActivate(makeContext({})))
      .rejects.toThrow('No se pudo determinar la organización');
  });

  it('toma la organización del usuario cuando la petición no la trae resuelta', async () => {
    const { guard, organizations } = makeGuard(
      { [REQUIRES_FEATURE_KEY]: 'crm' },
      { id: 'org-9', features: { crm: true } },
    );
    await expect(guard.canActivate(makeContext({ user: { organizationId: 'org-9' } }))).resolves.toBe(true);
    expect(organizations.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org-9' } }));
  });

  it('memoriza los módulos y los relee después de invalidar', async () => {
    const { guard, organizations } = makeGuard(
      { [REQUIRES_FEATURE_KEY]: 'reservations' },
      { id: 'org-1', features: { reservations: true } },
    );
    const context = makeContext({ organizationId: 'org-1' });
    await guard.canActivate(context);
    await guard.canActivate(context);
    expect(organizations.findOne).toHaveBeenCalledTimes(1);
    guard.invalidate('org-1');
    await guard.canActivate(context);
    expect(organizations.findOne).toHaveBeenCalledTimes(2);
  });
});

describe('normalizeOrganizationFeatures', () => {
  it('resuelve las claves ausentes al valor por defecto', () => {
    expect(normalizeOrganizationFeatures(null)).toEqual(DEFAULT_ORGANIZATION_FEATURES);
    expect(normalizeOrganizationFeatures({ production: true }).reservations).toBe(true);
    expect(normalizeOrganizationFeatures({ production: true }).production).toBe(true);
  });

  it('descarta las claves desconocidas', () => {
    const result = normalizeOrganizationFeatures({ inventado: true } as never);
    expect(Object.keys(result).sort()).toEqual([...ORGANIZATION_FEATURE_KEYS].sort());
  });

  it('ignora valores que no son booleanos para no encender un módulo por accidente', () => {
    expect(normalizeOrganizationFeatures({ production: 'si' } as never).production).toBe(false);
  });

  it('deja encendido solo el alcance de Fase 0 y 1 por defecto', () => {
    const enabled = ORGANIZATION_FEATURE_KEYS.filter((key) => DEFAULT_ORGANIZATION_FEATURES[key]);
    expect([...enabled].sort()).toEqual(
      ['clients', 'crm', 'dashboard', 'integrations', 'reservations', 'settings', 'users'],
    );
  });
});
