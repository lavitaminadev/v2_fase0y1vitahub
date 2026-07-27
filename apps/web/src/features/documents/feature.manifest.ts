import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'documents',
  name: 'Documentos',
  enabled: true,
  navigation: [{ label: 'Documentos', path: '/documents', icon: '📁', roles: ['admin', 'operations_director', 'creative_director', 'community_manager'] }],
  routes: [],
});
