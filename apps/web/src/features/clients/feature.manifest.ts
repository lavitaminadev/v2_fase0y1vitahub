import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'clients',
  name: 'Clientes',
  navigation: [{ label: 'Clientes', path: '/clients', icon: '👥', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] }],
  routes: [],
});
