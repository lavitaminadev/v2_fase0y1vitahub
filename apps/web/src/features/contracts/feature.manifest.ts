import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'contracts',
  name: 'Contratos',
  enabled: true,
  navigation: [{ label: 'Contratos', path: '/contracts', icon: '📄', roles: ['admin', 'commercial_director', 'operations_director'] }],
  routes: [],
});
