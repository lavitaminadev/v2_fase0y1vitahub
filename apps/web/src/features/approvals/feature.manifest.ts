import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'approvals',
  name: 'Aprobaciones',
  enabled: false,
  navigation: [{ label: 'Aprobaciones', path: '/approvals', icon: '✅', roles: ['admin', 'art_director', 'creative_director', 'operations_director', 'community_manager'] }],
  routes: [],
});
