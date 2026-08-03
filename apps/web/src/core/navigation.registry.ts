/**
 * @fileoverview Registro de navegación que recolecta manifiestos de features
 * y produce listas de navegación conscientes del rol.
 */

import type { UserRole } from '@vitahub/shared';
import type { FeatureManifest } from './feature.manifest';

/** Features registradas, ordenadas por orden de inserción. */
let features: FeatureManifest[] = [];

/** Orden preferido del sidebar para features habilitadas. Las no listadas se agregan alfabéticamente. */
const NAVIGATION_ORDER: string[] = [
  '/dashboard',
  '/reservations',
  '/reservations/calendar',
  '/reservations/availability',
  '/crm/contacts',
  '/clients',
  '/users',
  '/integrations/meta/events',
  '/crm/leads',
  '/crm/opportunities',
  '/crm/interactions',
  '/integrations',
  '/system/health',
  '/settings',
];

const FUTURE_PHASE_PATHS = new Set([
  '/production',
  '/audiovisual',
  '/content',
  '/documents',
  '/briefs',
  '/approvals',
  '/meetings',
  '/reports',
  '/billing',
  '/contracts',
  '/gamification',
  '/catalog',
  '/knowledge',
  '/onboarding',
  '/direction',
  '/operations',
  '/governance',
]);

function futureModulesEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_FUTURE_MODULES === 'true';
}

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
  '/integrations/meta/events': 'integrations',
  '/reservations': 'reservations',
  '/reservations/calendar': 'reservations',
  '/reservations/availability': 'reservations',
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
  '/system/health': 'settings',
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
  if (FUTURE_PHASE_PATHS.has(path) && !futureModulesEnabled()) return false;
  const required = getFeatureForPath(path);
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
