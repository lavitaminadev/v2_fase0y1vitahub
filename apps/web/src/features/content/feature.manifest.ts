import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'content',
  name: 'Contenido',
  enabled: true,
  // Creatividad revisa la grilla en el ciclo mensual y el backend ya se lo permitía, pero
  // no veía la entrada en el menú.
  navigation: [{ label: 'Contenido', path: '/content', icon: '📝', roles: ['admin', 'community_manager', 'creative_director', 'operations_director'] }],
  routes: [],
});
