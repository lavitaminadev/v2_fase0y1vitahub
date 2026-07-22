import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'briefs',
  name: 'Briefs',
  enabled: false,
  navigation: [{ label: 'Briefs', path: '/briefs', icon: '📋', roles: ['admin', 'operations_director', 'creative_director'] }],
  routes: [],
});
