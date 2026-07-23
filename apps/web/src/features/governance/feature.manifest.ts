import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'governance',
  name: 'Gobernanza',
  enabled: true,
  navigation: [{ label: 'Gobernanza', path: '/governance', icon: 'GOV', roles: ['admin', 'operations_director'] }],
  routes: [],
});
