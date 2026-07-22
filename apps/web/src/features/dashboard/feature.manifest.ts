import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'dashboard',
  name: 'Dashboard',
  navigation: [{ label: 'Dashboard', path: '/dashboard', icon: '📊' }],
  routes: [],
});
