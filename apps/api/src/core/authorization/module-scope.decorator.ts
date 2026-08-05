import { SetMetadata } from '@nestjs/common';
import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';

export const MODULE_SCOPE_KEY = 'moduleScope';
export const MODULE_EXEMPT_KEY = 'moduleExempt';

/**
 * Declara a qué módulo pertenece un controlador.
 *
 * Es lo que permite que los permisos configurados —los del cargo y las excepciones por
 * persona— se apliquen a todos sus endpoints sin anotarlos uno por uno: el módulo sale de
 * acá y el nivel exigido se deduce del verbo HTTP (consultar, modificar, administrar).
 *
 * Un endpoint que necesite un nivel distinto al que le corresponde por su verbo lo declara
 * con `@RequiresPermission`, que tiene precedencia.
 *
 * @param module - Clave del módulo, coincidente con `ORGANIZATION_FEATURE_KEYS`.
 */
export const ModuleScope = (module: OrganizationFeatureKey) => SetMetadata(MODULE_SCOPE_KEY, module);

/**
 * Exime a un controlador del control por módulo.
 *
 * Reservado para lo que no pertenece a ningún módulo del producto: autoservicio de la
 * propia cuenta, sondas de operación y utilidades transversales. La razón es obligatoria
 * porque cada exención es una puerta que queda fuera de la pantalla de permisos, y quien
 * revise el sistema debe poder leer por qué se abrió sin reconstruir la decisión.
 *
 * @param reason - Motivo de la exención, en una frase.
 */
export const ModuleExempt = (reason: string) => SetMetadata(MODULE_EXEMPT_KEY, reason);
