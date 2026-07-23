import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'meetings',
  name: 'Reuniones',
  enabled: true,
  navigation: [{ label: 'Reuniones', path: '/meetings', icon: '📅', roles: ['admin', 'operations_director', 'community_manager'] }],
  routes: [],
});
