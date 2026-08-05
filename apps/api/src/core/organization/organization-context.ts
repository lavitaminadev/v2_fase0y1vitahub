import { AsyncLocalStorage } from 'async_hooks';

/**
 * Organización vigente durante una petición.
 */
export interface OrganizationContextStore {
  /** Id de la organización del usuario autenticado, o `undefined` en rutas públicas. */
  organizationId?: string;
}

/**
 * Transporta la organización del usuario autenticado a través de las llamadas async, para
 * que las capas que no reciben el request puedan consultarla sin arrastrar el id por cada
 * firma intermedia.
 *
 * El único que escribe en este contexto es `OrganizationContextGuard`, y solo con el valor
 * que viene del JWT ya verificado. Nada de lo que envía el cliente llega hasta acá.
 */
export const organizationContext = new AsyncLocalStorage<OrganizationContextStore>();
