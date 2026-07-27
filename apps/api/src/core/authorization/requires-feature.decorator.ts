import { SetMetadata } from '@nestjs/common';
import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/**
 * Exige que el módulo esté habilitado en la organización.
 *
 * Complementa a `@Roles(...)` en lugar de sustituirlo: el rol determina si la persona tiene
 * el cargo adecuado y este decorador si la fase está activa. Un módulo deshabilitado no lo
 * alcanza ningún rol, incluido el de administración.
 *
 * @param feature - Clave del módulo, coincidente con `ORGANIZATION_FEATURE_KEYS`.
 */
export const RequiresFeature = (feature: OrganizationFeatureKey) => SetMetadata(REQUIRES_FEATURE_KEY, feature);
