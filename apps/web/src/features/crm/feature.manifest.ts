import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'Contactos',
  navigation: [{ label: 'Contactos', path: '/crm/contacts', icon: 'CM', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] }],
  routes: [],
});
