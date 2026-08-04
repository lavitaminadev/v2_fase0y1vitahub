import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y formularios',
  navigation: [
    {
      label: 'Reservas y formularios',
      path: '/reservations',
      icon: '🗓️',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Agenda del servicio',
      path: '/reservations/agenda',
      icon: '📆',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Calendario de disponibilidad',
      path: '/reservations/calendar',
      icon: '🗓️',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Lista de espera',
      path: '/reservations/waitlist',
      icon: '⏳',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Analíticas',
      path: '/reservations/analytics',
      icon: '📊',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
  ],
  routes: [],
});
