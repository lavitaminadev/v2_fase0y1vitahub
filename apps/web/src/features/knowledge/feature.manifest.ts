import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'knowledge',
  name: 'Conocimiento',
  enabled: true,
  navigation: [{ label: 'Conocimiento', path: '/knowledge', icon: '🧠', roles: ['admin', 'ai_lead'] }],
  routes: [],
});
