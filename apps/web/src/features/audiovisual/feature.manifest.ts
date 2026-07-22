import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'audiovisual',
  name: 'Audiovisual',
  enabled: false,
  navigation: [{
    label: 'Audiovisual',
    path: '/audiovisual',
    icon: 'AV',
    roles: ['admin', 'creative_director', 'operations_director', 'av_director', 'audiovisual'],
  }],
  routes: [],
});
