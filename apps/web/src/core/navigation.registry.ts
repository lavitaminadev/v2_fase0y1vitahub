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
  '/clients',
  '/users',
  '/reservations',
  '/crm/contacts',
  '/crm/leads',
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
  '/integrations',
  '/onboarding',
  '/direction',
  '/operations',
  '/governance',
  '/settings',
];

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
export function getNavigation(userRole?: UserRole): FeatureManifest['navigation'] {
  const roleAwareItems = getFeatures(userRole)
    .flatMap((f) => f.navigation)
    .filter((item) => !item.roles || !userRole || item.roles.includes(userRole));

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
 * Devuelve todas las rutas registradas por las features habilitadas.
 */
export function getAllRoutes(): FeatureManifest['routes'] {
  return getFeatures().flatMap((f) => f.routes);
}
