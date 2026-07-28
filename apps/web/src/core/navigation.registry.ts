/**
 * @fileoverview Registro de navegación que recolecta manifiestos de features
 * y produce listas de navegación conscientes del rol.
 */

import type { UserRole } from '@vitahub/shared';
import type { FeatureManifest } from './feature.manifest';
import { isModuleInPhaseScope } from './phase-scope';

/** Features registradas, ordenadas por orden de inserción. */
let features: FeatureManifest[] = [];

/**
 * Secciones del sidebar, en orden de aparición, con las rutas que contiene cada una.
 *
 * Agrupar responde a una confusión concreta: VITAHUB tiene dos CRM distintos. «CRM»
 * reúne lo que la agencia opera **para** sus clientes (reservas y los contactos
 * que llegan de sus campañas), y «Pipeline» es el pipeline propio de la
 * agencia (leads, oportunidades, contratos). Verlos en secciones separadas evita
 * leerlos como un mismo embudo.
 *
 * Una ruta sin sección cae en «Más», de modo que registrar una feature nueva nunca la
 * esconde del menú.
 */
export const NAVIGATION_SECTIONS: Array<{ id: string; label: string; paths: string[] }> = [
  { id: 'today', label: 'Hoy', paths: ['/dashboard'] },
  {
    id: 'crm',
    label: 'CRM',
    paths: ['/reservations', '/crm/contacts'],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    paths: ['/crm/leads', '/crm/opportunities', '/crm/interactions', '/catalog', '/contracts', '/billing'],
  },
  {
    id: 'accounts',
    label: 'Cuentas',
    paths: ['/clients', '/onboarding', '/meetings', '/briefs', '/documents'],
  },
  {
    id: 'production',
    label: 'Producción',
    paths: ['/production', '/content', '/audiovisual', '/approvals', '/gamification'],
  },
  { id: 'insight', label: 'Análisis', paths: ['/reports', '/direction'] },
  {
    id: 'admin',
    label: 'Administración',
    paths: ['/users', '/settings', '/integrations', '/governance', '/operations', '/knowledge'],
  },
];

/** Orden preferido del sidebar, derivado de las secciones para no mantener dos listas. */
const NAVIGATION_ORDER: string[] = NAVIGATION_SECTIONS.flatMap((section) => section.paths);

/**
 * Registra un manifiesto de feature.
 *
 * @param feature - Descriptor de la feature a registrar.
 */
export function registerFeature(feature: FeatureManifest): void {
  features.push(feature);
}

/**
 * Devuelve todas las features habilitadas, opcionalmente filtradas por rol.
 *
 * @param _userRole - Rol del usuario actual usado para filtrar.
 * @returns Lista de features filtrada.
 */
export function getFeatures(_userRole?: UserRole): FeatureManifest[] {
  return features.filter((f) => {
    if (f.enabled === false) return false;
    if (!f.permissions?.length && !f.dependencies?.length) return true;
    return true;
  });
}

/**
 * Devuelve las entradas de navegación visibles para el rol dado.
 *
 * @param userRole - Rol del usuario actual.
 * @returns Items de navegación filtrados y ordenados según el orden configurado.
 */
export function getNavigation(
  userRole?: UserRole,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
): FeatureManifest['navigation'] {
  const roleAwareItems = getFeatures(userRole)
    .flatMap((f) => f.navigation)
    .filter((item) => !item.roles || !userRole || item.roles.includes(userRole))
    .filter((item) => isPathEnabled(item.path, features, permissions));

  const orderMap = new Map(NAVIGATION_ORDER.map((p, i) => [p, i]));
  return roleAwareItems
    .slice()
    .sort((a, b) => (orderMap.get(a.path) ?? 999) - (orderMap.get(b.path) ?? 999));
}

/** Sección del sidebar ya resuelta, con los items que el usuario actual puede ver. */
export interface NavigationSection {
  id: string;
  label: string;
  items: NonNullable<FeatureManifest['navigation']>;
}

/**
 * Agrupa la navegación visible en secciones, descartando las que quedan vacías.
 *
 * Las rutas sin sección declarada se agrupan al final bajo «Más», para que una feature
 * recién registrada aparezca en el menú aunque nadie la haya asignado todavía.
 *
 * @param userRole - Rol del usuario actual.
 * @param features - Módulos habilitados en la organización.
 * @param permissions - Overrides de permiso por módulo.
 */
export function getNavigationSections(
  userRole?: UserRole,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
): NavigationSection[] {
  const items = getNavigation(userRole, features, permissions) ?? [];
  const byPath = new Map(items.map((item) => [item.path, item]));
  const assigned = new Set<string>();

  const sections = NAVIGATION_SECTIONS.map((section) => {
    const sectionItems = section.paths.flatMap((path) => {
      const item = byPath.get(path);
      if (!item) return [];
      assigned.add(path);
      return [item];
    });
    return { id: section.id, label: section.label, items: sectionItems };
  }).filter((section) => section.items.length > 0);

  const rest = items.filter((item) => !assigned.has(item.path));
  if (rest.length > 0) sections.push({ id: 'more', label: 'Más', items: rest });
  return sections;
}

/**
 * Devuelve la lista blanca de roles explícita para una ruta dada, cuando está
 * declarada en un item de navegación de un manifiesto de feature.
 */
export function getAllowedRolesForPath(path: string): UserRole[] | undefined {
  return getFeatures()
    .flatMap((f) => f.navigation)
    .find((item) => item.path === path)?.roles;
}

/**
 * Módulo de organización al que pertenece cada ruta.
 *
 * La tabla vive acá, en un solo lugar, en vez de repetirse en los veinte manifiestos: es
 * más fácil de auditar y las claves deben coincidir con `ORGANIZATION_FEATURE_KEYS` del
 * backend. Una ruta sin entrada se considera siempre habilitada (login, perfil, 404).
 */
const PATH_FEATURE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/clients': 'clients',
  '/users': 'users',
  '/settings': 'settings',
  '/integrations': 'integrations',
  '/reservations': 'reservations',
  '/crm/contacts': 'crm',
  '/crm/leads': 'commercialPipeline',
  '/crm/opportunities': 'commercialPipeline',
  '/crm/interactions': 'commercialPipeline',
  '/production': 'production',
  '/audiovisual': 'audiovisual',
  '/content': 'content',
  '/documents': 'documents',
  '/briefs': 'briefs',
  '/approvals': 'approvals',
  '/meetings': 'meetings',
  '/reports': 'reports',
  '/billing': 'billing',
  '/contracts': 'contracts',
  '/gamification': 'gamification',
  '/catalog': 'catalog',
  '/knowledge': 'knowledge',
  '/onboarding': 'onboarding',
  '/direction': 'direction',
  '/operations': 'operations',
  '/governance': 'governance',
};

/** Módulo requerido por una ruta, o `undefined` si la ruta no depende de ninguno. */
export function getFeatureForPath(path: string): string | undefined {
  return PATH_FEATURE[path];
}

/**
 * Indica si una ruta está disponible para el usuario.
 *
 * Prioriza los permisos efectivos que resuelve el backend, que ya combinan módulo
 * habilitado, cargo y excepciones por persona. Si no están disponibles, recurre a los
 * módulos habilitados de la organización.
 *
 * Mientras no se conoce ninguno de los dos —la sesión aún carga— responde `true` para no
 * ocultar el menú completo durante un instante en cada recarga.
 *
 * @param path - Ruta declarada en un manifiesto de feature.
 * @param features - Módulos habilitados en la organización.
 * @param permissions - Nivel efectivo por módulo del usuario autenticado.
 */
export function isPathEnabled(
  path: string,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
): boolean {
  const required = getFeatureForPath(path);
  // El alcance de fase se evalúa antes que permisos y capacidades: un módulo que el producto
  // todavía no ofrece no debe aparecer para nadie, por más permisos que tenga el usuario.
  if (!isModuleInPhaseScope(required)) return false;
  if (!required) return true;
  if (permissions) return permissions[required] !== undefined && permissions[required] !== 'none';
  if (features) return features[required] !== false;
  return true;
}

/**
 * Devuelve todas las rutas registradas por las features habilitadas.
 */
export function getAllRoutes(): FeatureManifest['routes'] {
  return getFeatures().flatMap((f) => f.routes);
}
