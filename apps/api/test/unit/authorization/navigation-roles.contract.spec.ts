import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrato entre el menu del frontend y los permisos del backend.
 *
 * El menu se declara en `feature.manifest.ts` y el permiso real en `@Roles(...)` de cada
 * controlador. Son archivos distintos y nada los obliga a coincidir: cuando divergen, nada
 * falla al compilar y el usuario lo descubre al hacer clic y recibir un 403.
 *
 * Esta prueba falla si el menu ofrece una pantalla a un rol que el backend no acepta en
 * ningun endpoint de su controlador. El error siempre aparecio en esa direccion: alguien
 * agrega un rol a la navegacion y no baja a tocar el controlador.
 */

const REPO_ROOT = resolve(__dirname, '../../../../..');
const WEB_FEATURES = join(REPO_ROOT, 'apps/web/src/features');
const API_MODULES = join(REPO_ROOT, 'apps/api/src/modules');

/**
 * Controlador que respalda cada ruta del menu.
 *
 * Es explicito a proposito: derivarlo del path por convencion haria que una ruta sin
 * coincidencia se omitiera en silencio, que es justo el modo de fallo que se quiere evitar.
 * `null` marca las rutas que no tienen un controlador propio.
 */
const PATH_CONTROLLER: Record<string, string | null> = {
  '/approvals': 'approvals/approvals.controller.ts',
  '/billing': 'billing/billing.controller.ts',
  '/briefs': 'briefs/briefs.controller.ts',
  '/catalog': 'catalog/catalog.controller.ts',
  '/clients': 'clients/clients.controller.ts',
  '/content': 'content/content.controller.ts',
  '/contracts': 'contracts/contracts.controller.ts',
  // La pantalla de contactos de reservas consume /crm/leads, no /crm/contacts.
  '/crm/contacts': 'crm/leads/lead.controller.ts',
  '/crm/leads': 'crm/leads/lead.controller.ts',
  '/crm/opportunities': 'crm/opportunities/opportunities.controller.ts',
  '/crm/interactions': 'crm/interactions/interactions.controller.ts',
  '/documents': 'documents/documents.controller.ts',
  '/gamification': 'gamification/gamification.controller.ts',
  '/knowledge': 'knowledge/knowledge.controller.ts',
  '/meetings': 'meetings/meetings.controller.ts',
  '/onboarding': 'onboarding/onboarding.controller.ts',
  '/production': 'production/production.controller.ts',
  '/reports': 'reports/reports.controller.ts',
  '/reservations': 'reservations/reservations.controller.ts',
  '/users': 'users/users.controller.ts',
  // Pantallas compuestas: agregan datos de varios modulos y no tienen un controlador unico.
  '/dashboard': null,
  '/direction': null,
  '/governance': null,
  '/operations': null,
  '/settings': null,
  '/integrations': null,
  '/audiovisual': null,
};

/** Roles declarados en la navegacion, por ruta. */
function navigationRoles(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const feature of readdirSync(WEB_FEATURES, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const manifest = join(WEB_FEATURES, feature.name, 'feature.manifest.ts');
    if (!existsSync(manifest)) continue;
    const source = readFileSync(manifest, 'utf8');
    for (const entry of source.matchAll(/path:\s*'([^']+)'[^}]*?roles:\s*\[([^\]]*)\]/g)) {
      const [, path, rawRoles] = entry;
      const roles = [...rawRoles.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
      if (roles.length > 0) result.set(path, roles);
    }
  }
  return result;
}

/** Union de todos los roles que aparecen en cualquier `@Roles(...)` del controlador. */
function controllerRoles(relativePath: string): Set<string> {
  const file = join(API_MODULES, relativePath);
  const source = readFileSync(file, 'utf8');
  const roles = new Set<string>();
  for (const match of source.matchAll(/UserRole\.([A-Z_]+)/g)) roles.add(match[1].toLowerCase());
  return roles;
}

describe('contrato entre navegación y permisos del backend', () => {
  const navigation = navigationRoles();

  it('encuentra las entradas de navegación de los manifiestos', () => {
    expect(navigation.size).toBeGreaterThan(10);
  });

  it('cada ruta del menú está mapeada a un controlador o marcada sin controlador', () => {
    const unmapped = [...navigation.keys()].filter((path) => !(path in PATH_CONTROLLER));
    expect(unmapped, `Rutas nuevas sin mapear en PATH_CONTROLLER: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('los controladores mapeados existen', () => {
    const missing = Object.entries(PATH_CONTROLLER)
      .filter(([, file]) => file !== null && !existsSync(join(API_MODULES, file)))
      .map(([path, file]) => `${path} → ${file}`);
    expect(missing, `Controladores inexistentes: ${missing.join(', ')}`).toEqual([]);
  });

  it('ningún rol ve una pantalla que el backend le rechaza', () => {
    const mismatches: string[] = [];
    for (const [path, navRoles] of navigation) {
      const controller = PATH_CONTROLLER[path];
      if (!controller) continue;
      const allowed = controllerRoles(controller);
      // 'admin' se acepta siempre: aunque no aparezca en un @Roles concreto, es el rol que
      // por diseño alcanza todo lo que este habilitado.
      const denied = navRoles.filter((role) => role !== 'admin' && !allowed.has(role));
      if (denied.length > 0) {
        mismatches.push(`${path}: el menú lo ofrece a [${denied.join(', ')}] pero ${controller} no los acepta`);
      }
    }
    expect(mismatches, `Desajustes entre menú y backend:\n  ${mismatches.join('\n  ')}`).toEqual([]);
  });
});
