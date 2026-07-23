import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'billing',
  name: 'Facturación',
  enabled: true,
  navigation: [{ label: 'Facturación', path: '/billing', icon: '💰', roles: ['admin', 'commercial_director', 'operations_director'] }],
  routes: [],
});
