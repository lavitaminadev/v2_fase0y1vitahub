import { SetMetadata } from '@nestjs/common';
import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import type { PermissionLevel } from './permission-level';

export const REQUIRES_PERMISSION_KEY = 'requiresPermission';

export interface RequiredPermission {
  module: OrganizationFeatureKey;
  level: PermissionLevel;
}

/**
 * Exige un nivel mínimo sobre un módulo, resuelto con `PermissionResolverService`.
 *
 * Contempla las tres condiciones a la vez —módulo habilitado, nivel del cargo y excepción
 * por usuario—, por lo que reemplaza la combinación de `@Roles` y `@RequiresFeature` en los
 * endpoints donde se aplica.
 *
 * @param module - Módulo sobre el que se exige acceso.
 * @param level - Nivel mínimo requerido; los niveles superiores también lo satisfacen.
 */
export const RequiresPermission = (module: OrganizationFeatureKey, level: PermissionLevel) =>
  SetMetadata(REQUIRES_PERMISSION_KEY, { module, level } satisfies RequiredPermission);
