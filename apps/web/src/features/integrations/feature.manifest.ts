import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'integrations',
  name: 'Integraciones',
  navigation: [
    { label: 'Eventos CAPI', path: '/integrations/meta/events', icon: 'CAPI', roles: ['admin'] },
    { label: 'Integraciones', path: '/integrations', icon: 'INT', roles: ['admin'] },
  ],
  routes: [],
});
