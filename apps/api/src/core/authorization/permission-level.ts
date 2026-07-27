/**
 * Niveles de acceso a un módulo, ordenados de menor a mayor.
 *
 * Cada nivel incluye a los anteriores: quien puede `edit` también puede `view`. La
 * comparación se hace por posición en este arreglo, no por igualdad, para que un endpoint
 * que pide `view` acepte a quien tiene `manage`.
 */
export const PERMISSION_LEVELS = ['none', 'view', 'edit', 'manage'] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/**
 * Indica si un nivel concedido cubre el nivel requerido.
 *
 * @param granted - Nivel que tiene el usuario sobre el módulo.
 * @param required - Nivel mínimo que exige la operación.
 */
export function satisfies(granted: PermissionLevel, required: PermissionLevel): boolean {
  return PERMISSION_LEVELS.indexOf(granted) >= PERMISSION_LEVELS.indexOf(required);
}

export function isPermissionLevel(value: string): value is PermissionLevel {
  return (PERMISSION_LEVELS as readonly string[]).includes(value);
}
