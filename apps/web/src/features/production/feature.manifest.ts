import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'production',
  name: 'Producción',
  enabled: true,
  navigation: [{ label: 'Producción', path: '/production', icon: '🎨', roles: ['admin', 'art_director', 'operations_director', 'designer', 'audiovisual'] }],
  routes: [],
});
