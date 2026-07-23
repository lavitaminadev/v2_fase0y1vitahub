import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'catalog',
  name: 'Catálogo',
  enabled: true,
  navigation: [{ label: 'Catálogo', path: '/catalog', icon: '🏷️', roles: ['admin', 'commercial_director'] }],
  routes: [],
});
