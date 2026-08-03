import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    { label: 'Comensales y contactos', path: '/crm/contacts', icon: 'CM', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'Prospectos de agencia', path: '/crm/leads', icon: 'LD', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'Pipeline comercial', path: '/crm/opportunities', icon: 'OP', roles: ['admin', 'commercial_director'] },
    { label: 'Actividad comercial', path: '/crm/interactions', icon: 'IN', roles: ['admin', 'commercial_director'] },
  ],
  routes: [],
});
