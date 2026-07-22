import { AsyncLocalStorage } from 'async_hooks';

/**
 * Store held by the tenant AsyncLocalStorage.
 */
export interface TenantContextStore {
  /** Resolved organization id for the current request. */
  organizationId?: string;
}

/**
 * AsyncLocalStorage that carries the current tenant id through async calls.
 *
 * Use `tenantContext.getStore()` to access the current tenant without passing
 * `organizationId` explicitly through every layer.
 */
export const tenantContext = new AsyncLocalStorage<TenantContextStore>();
