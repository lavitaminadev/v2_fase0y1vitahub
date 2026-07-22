/**
 * @fileoverview Navigation registry that collects feature manifests and
 * produces role-aware navigation lists.
 */

import type { UserRole } from '@vitahub/shared';
import type { FeatureManifest } from './feature.manifest';

/** Registered features sorted by insertion order. */
let features: FeatureManifest[] = [];

const PHASE_ONE_NAVIGATION_ORDER = [
  '/dashboard',
  '/clients',
  '/users',
  '/reservations',
  '/crm/contacts',
  '/integrations',
  '/settings',
] as const;

const PHASE_ONE_NAVIGATION_LABELS: Partial<Record<(typeof PHASE_ONE_NAVIGATION_ORDER)[number], string>> = {
  '/dashboard': 'Inicio',
  '/clients': 'Empresas',
  '/reservations': 'Reservas',
  '/crm/contacts': 'Contactos',
};

/**
 * Registers a feature manifest.
 *
 * @param feature - Feature descriptor to register.
 */
export function registerFeature(feature: FeatureManifest): void {
  features.push(feature);
}

/**
 * Returns all enabled features, optionally filtered by role.
 *
 * @param _userRole - Current user role used for filtering.
 * @returns Filtered feature list.
 */
export function getFeatures(_userRole?: UserRole): FeatureManifest[] {
  return features.filter((f) => {
    if (f.enabled === false) return false;
    if (!f.permissions?.length && !f.dependencies?.length) return true;
    // Role filtering can be extended here once permission rules are defined.
    return true;
  });
}

/**
 * Returns the navigation entries visible for the given role.
 *
 * @param userRole - Current user role.
 * @returns Filtered navigation items.
 */
export function getNavigation(userRole?: UserRole): FeatureManifest['navigation'] {
  const roleAwareItems = getFeatures(userRole)
    .flatMap((f) => f.navigation)
    .filter((item) => !item.roles || !userRole || item.roles.includes(userRole));

  return PHASE_ONE_NAVIGATION_ORDER.flatMap((path) => {
    const item = roleAwareItems.find((candidate) => candidate.path === path);
    if (!item) return [];
    return [{ ...item, label: PHASE_ONE_NAVIGATION_LABELS[path] ?? item.label }];
  });
}

/**
 * Returns the explicit role allow-list for a given path when declared in a
 * feature manifest navigation item.
 */
export function getAllowedRolesForPath(path: string): UserRole[] | undefined {
  return getFeatures()
    .flatMap((f) => f.navigation)
    .find((item) => item.path === path)?.roles;
}

/**
 * Returns all routes registered by enabled features.
 */
export function getAllRoutes(): FeatureManifest['routes'] {
  return getFeatures().flatMap((f) => f.routes);
}
