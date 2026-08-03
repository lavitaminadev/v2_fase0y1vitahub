import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y formularios',
  navigation: [
    {
      label: 'Reservas',
      path: '/reservations',
      icon: 'RS',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Calendario',
      path: '/reservations/calendar',
      icon: 'CA',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Disponibilidad',
      path: '/reservations/availability',
      icon: 'DI',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
  ],
  routes: [],
});
