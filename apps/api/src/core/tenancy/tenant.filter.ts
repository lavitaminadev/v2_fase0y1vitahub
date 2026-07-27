import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { tenantContext } from './tenant-context';
import { SKIP_TENANCY_KEY } from './skip-tenancy.decorator';

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<any>) {
    const store = tenantContext.getStore();
    if (!store?.organizationId) return;

    const entity = event.entity;
    if (!entity) return;

    const target = event.metadata.target;
    if (typeof target === 'function' && Reflect.getMetadata(SKIP_TENANCY_KEY, target)) {
      return;
    }

    const hasOrgColumn = event.metadata.columns.some(
      c => c.propertyName === 'organizationId',
    );
    if (!hasOrgColumn) return;

    if (!entity.organizationId) {
      entity.organizationId = store.organizationId;
    }
  }
}
