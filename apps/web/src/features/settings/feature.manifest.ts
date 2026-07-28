import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Configuración',
  navigation: [{ label: 'Configuración', path: '/settings', icon: '⚙️', roles: ['admin', 'operations_director'] }],
  routes: [],
});
