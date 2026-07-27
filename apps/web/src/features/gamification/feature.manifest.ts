import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'gamification',
  name: 'Gamificación',
  enabled: true,
  navigation: [{ label: 'Gamificación', path: '/gamification', icon: '🏆', roles: ['admin', 'art_director', 'av_director', 'designer', 'audiovisual'] }],
  routes: [],
});
