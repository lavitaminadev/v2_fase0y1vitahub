import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    // Contactos de campañas: los contactos de los clientes de la agencia, que opera el
    // equipo. Las tres entradas siguientes son el pipeline comercial de La Vitamina —sus
    // propios prospectos— y corresponden a dirección comercial.
    { label: 'Contactos de campañas', path: '/crm/contacts', icon: 'CM', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'Pipeline comercial', path: '/crm/leads', icon: 'LD', roles: ['admin', 'commercial_director'] },
    { label: 'Oportunidades', path: '/crm/opportunities', icon: 'OP', roles: ['admin', 'commercial_director'] },
    { label: 'Actividad comercial', path: '/crm/interactions', icon: 'IN', roles: ['admin', 'commercial_director'] },
  ],
  routes: [],
});
