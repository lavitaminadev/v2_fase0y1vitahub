import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'operations',
  name: 'Operaciones',
  enabled: false,
  navigation: [{ label: 'Operaciones', path: '/operations', icon: '⚙️', roles: ['admin', 'operations_director'] }],
  routes: [],
});
