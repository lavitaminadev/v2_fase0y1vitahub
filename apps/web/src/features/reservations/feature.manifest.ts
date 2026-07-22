import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y formularios',
  navigation: [{
    label: 'Reservas y formularios',
    path: '/reservations',
    icon: 'RF',
    roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
  }],
  routes: [],
});
