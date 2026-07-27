import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'integrations',
  name: 'Integraciones',
  navigation: [{ label: 'Integraciones', path: '/integrations', icon: '🔗', roles: ['admin'] }],
  routes: [],
});
