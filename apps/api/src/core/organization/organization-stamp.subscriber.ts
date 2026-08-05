import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { organizationContext } from './organization-context';

/**
 * Rellena `organizationId` en las filas nuevas que no lo traen.
 *
 * Es una red de seguridad, no la vía principal: los servicios siguen pasando la
 * organización explícitamente. Sirve para que un `save()` que olvidó el campo falle como
 * dato correcto en vez de como fila huérfana.
 *
 * Solo actúa cuando hay contexto resuelto, es decir en peticiones autenticadas. Las
 * escrituras de rutas públicas y de trabajos programados no pasan por acá y deben indicar
 * la organización ellas mismas.
 */
@EventSubscriber()
export class OrganizationStampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    const organizationId = organizationContext.getStore()?.organizationId;
    if (!organizationId) return;

    const entity = event.entity;
    if (!entity || entity.organizationId) return;

    const hasOrganizationColumn = event.metadata.columns.some((column) => column.propertyName === 'organizationId');
    if (!hasOrganizationColumn) return;

    entity.organizationId = organizationId;
  }
}
