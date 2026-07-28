import { describe, expect, it } from 'vitest';
import {
  OUT_OF_SCOPE_MODULES,
  PHASE_1_MODULES,
  PHASE_SCOPE_ENABLED,
  isModuleInPhaseScope,
} from './phase-scope';
import { getFeatureForPath, isPathEnabled } from './navigation.registry';

describe('alcance de fase', () => {
  it('deja pasar los módulos del circuito de reservas y conversiones', () => {
    for (const module of ['reservations', 'crm', 'integrations', 'clients', 'reports']) {
      expect(isModuleInPhaseScope(module), module).toBe(true);
    }
  });

  it('oculta los módulos fuera de alcance', () => {
    for (const module of ['production', 'billing', 'gamification', 'adsInsights']) {
      expect(isModuleInPhaseScope(module), module).toBe(false);
    }
  });

  it('mantiene visible el pipeline comercial por decisión explícita', () => {
    // El brief lo excluye de lo que hay que *construir*, no de lo que se muestra. Si algún día
    // se decide ocultarlo, mover la clave y actualizar esta expectativa.
    expect(isModuleInPhaseScope('commercialPipeline')).toBe(true);
  });

  it('no clasifica un módulo en las dos listas a la vez', () => {
    const duplicated = PHASE_1_MODULES.filter((module) => module in OUT_OF_SCOPE_MODULES);
    expect(duplicated).toEqual([]);
  });

  it('deja visible un módulo desconocido, para que registrar una feature no la esconda', () => {
    expect(isModuleInPhaseScope('modulo-que-todavia-no-existe')).toBe(true);
    expect(isModuleInPhaseScope(undefined)).toBe(true);
  });

  it('el interruptor está encendido mientras dure el alcance de Fase 0 y 1', () => {
    // Si esta prueba falla es porque alguien reactivó la plataforma completa. Es una decisión
    // válida: actualizar la expectativa junto con el cambio, para que quede registrada.
    expect(PHASE_SCOPE_ENABLED).toBe(true);
  });
});

describe('navegación bajo el alcance de fase', () => {
  const visible = (path: string) => isPathEnabled(path, undefined, undefined);

  it('mantiene las rutas del alcance aunque el usuario tenga todos los permisos', () => {
    for (const path of ['/dashboard', '/reservations', '/crm/contacts', '/clients', '/integrations', '/reports']) {
      expect(visible(path), path).toBe(true);
    }
  });

  it('oculta las rutas fuera de alcance para cualquier rol', () => {
    const outOfScopePaths = ['/production', '/content', '/audiovisual', '/approvals', '/briefs',
      '/meetings', '/billing', '/contracts', '/catalog', '/gamification', '/knowledge',
      '/onboarding', '/direction', '/operations', '/governance', '/documents'];

    for (const path of outOfScopePaths) {
      expect(visible(path), path).toBe(false);
    }
  });

  it('deja visibles las rutas del pipeline comercial', () => {
    for (const path of ['/crm/leads', '/crm/opportunities', '/crm/interactions']) {
      expect(visible(path), path).toBe(true);
    }
  });

  it('el permiso explícito no alcanza para reabrir una ruta fuera de alcance', () => {
    // El alcance de fase se evalúa antes que los permisos: un administrador tampoco la ve.
    expect(isPathEnabled('/production', { production: true }, { production: 'admin' })).toBe(false);
  });

  it('toda ruta fuera de alcance declara su módulo, sin lo cual no se podría ocultar', () => {
    for (const path of ['/production', '/billing', '/contracts']) {
      expect(getFeatureForPath(path), path).toBeDefined();
    }
  });
});
