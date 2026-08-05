import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '../../../src/core/authorization/permission.guard';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import { MODULE_EXEMPT_KEY, MODULE_SCOPE_KEY } from '../../../src/core/authorization/module-scope.decorator';
import { REQUIRES_PERMISSION_KEY } from '../../../src/core/authorization/requires-permission.decorator';
import { REQUIRES_FEATURE_KEY } from '../../../src/core/authorization/requires-feature.decorator';

const AUTHENTICATED = { id: 'user-1', role: 'designer', organizationId: 'org-1' };

/** Reflector que responde solo a las claves indicadas y `undefined` al resto. */
function reflectorWith(metadata: Record<string, unknown>) {
  return { getAllAndOverride: vi.fn((key: string) => metadata[key]) } as any;
}

function executionContext(method = 'GET', request: Record<string, unknown> = { user: AUTHENTICATED, organizationId: 'org-1' }) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ method, url: '/api/prueba', ...request }) }),
  } as any;
}

function resolverThatAnswers(allowed: boolean) {
  return { can: vi.fn().mockResolvedValue(allowed) } as any;
}

describe('PermissionGuard', () => {
  it('niega un endpoint que no declara módulo', async () => {
    // Es la diferencia central: antes lo no anotado pasaba libre, de modo que quitarle un
    // modulo a alguien ocultaba su menu pero la API le seguia respondiendo.
    const guard = new PermissionGuard(reflectorWith({}), resolverThatAnswers(true));

    await expect(guard.canActivate(executionContext())).rejects.toThrow(ForbiddenException);
  });

  it('deja pasar las rutas públicas sin consultar permisos', async () => {
    const resolver = resolverThatAnswers(false);
    const guard = new PermissionGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }), resolver);

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
    expect(resolver.can).not.toHaveBeenCalled();
  });

  it('deja pasar lo declarado exento', async () => {
    const resolver = resolverThatAnswers(false);
    const guard = new PermissionGuard(
      reflectorWith({ [MODULE_EXEMPT_KEY]: 'Autoservicio de la propia cuenta' }),
      resolver,
    );

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
    expect(resolver.can).not.toHaveBeenCalled();
  });

  it('deduce el nivel del verbo: consultar exige view', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'clients' }), resolver);

    await guard.canActivate(executionContext('GET'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'clients', 'view');
  });

  it('deduce el nivel del verbo: modificar exige edit', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'clients' }), resolver);

    await guard.canActivate(executionContext('PATCH'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'clients', 'edit');
  });

  it('deduce el nivel del verbo: borrar exige manage', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'clients' }), resolver);

    await guard.canActivate(executionContext('DELETE'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'clients', 'manage');
  });

  it('toma el módulo de @RequiresFeature cuando no hay @ModuleScope', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [REQUIRES_FEATURE_KEY]: 'billing' }), resolver);

    await guard.canActivate(executionContext('GET'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'billing', 'view');
  });

  it('da precedencia al nivel explícito de @RequiresPermission sobre el verbo', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(
      reflectorWith({
        [REQUIRES_PERMISSION_KEY]: { module: 'reports', level: 'manage' },
        [MODULE_SCOPE_KEY]: 'clients',
      }),
      resolver,
    );

    await guard.canActivate(executionContext('GET'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'reports', 'manage');
  });

  it('rechaza cuando el nivel resuelto no alcanza', async () => {
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'billing' }), resolverThatAnswers(false));

    await expect(guard.canActivate(executionContext('GET'))).rejects.toThrow(ForbiddenException);
  });

  it('rechaza cuando la petición no trae usuario resuelto', async () => {
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'clients' }), resolverThatAnswers(true));

    await expect(guard.canActivate(executionContext('GET', {}))).rejects.toThrow(ForbiddenException);
  });
});
