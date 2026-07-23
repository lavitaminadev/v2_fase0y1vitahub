import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reports',
  name: 'Reportes',
  enabled: true,
  navigation: [{ label: 'Reportes', path: '/reports', icon: '📈', roles: ['admin', 'commercial_director', 'creative_director', 'operations_director', 'art_director', 'av_director', 'ai_lead', 'community_manager'] }],
  routes: [],
});
