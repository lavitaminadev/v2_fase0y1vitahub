import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Configuracion',
  navigation: [
    { label: 'Salud sistema', path: '/system/health', icon: 'HS', roles: ['admin', 'operations_director'] },
    { label: 'Configuracion', path: '/settings', icon: 'CF', roles: ['admin', 'operations_director'] },
  ],
  routes: [],
});
