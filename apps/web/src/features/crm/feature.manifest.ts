import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    { label: 'CRM Contactos', path: '/crm/contacts', icon: 'CM', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'CRM Leads', path: '/crm/leads', icon: 'LD', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'CRM Oportunidades', path: '/crm/opportunities', icon: 'OP', roles: ['admin', 'commercial_director'] },
    { label: 'CRM Interacciones', path: '/crm/interactions', icon: 'IN', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
  ],
  routes: [],
});
