import { AsyncLocalStorage } from 'async_hooks';

/**
 * Store que mantiene el AsyncLocalStorage del tenant.
 */
export interface TenantContextStore {
  /** Id de organización resuelto para el request actual. */
  organizationId?: string;
}

/**
 * AsyncLocalStorage que transporta el id del tenant actual a través de las
 * llamadas async.
 *
 * Usa `tenantContext.getStore()` para acceder al tenant actual sin pasar
 * `organizationId` explícitamente por cada capa.
 */
export const tenantContext = new AsyncLocalStorage<TenantContextStore>();
