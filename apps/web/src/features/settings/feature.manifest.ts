import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Configuracion',
  navigation: [{ label: 'Configuracion', path: '/settings', icon: '⚙️', roles: ['admin', 'operations_director'] }],
  routes: [],
});
