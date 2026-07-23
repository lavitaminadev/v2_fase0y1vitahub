import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'content',
  name: 'Contenido',
  enabled: true,
  navigation: [{ label: 'Contenido', path: '/content', icon: '📝', roles: ['admin', 'community_manager', 'operations_director'] }],
  routes: [],
});
