import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'onboarding',
  name: 'Onboarding',
  enabled: true,
  navigation: [{ label: 'Onboarding', path: '/onboarding', icon: '🚀', roles: ['admin', 'operations_director'] }],
  routes: [],
});
