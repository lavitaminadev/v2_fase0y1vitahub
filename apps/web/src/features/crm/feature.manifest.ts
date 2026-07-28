import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    // Son dos CRM distintos y no deben leerse como un mismo embudo:
    //
    // 1. Contactos de campañas — el CRM DE LOS CLIENTES. Personas que llegaron por las
    //    campañas de cada cliente, incluidas las que reservaron. Lo opera el equipo.
    // 2. Prospectos / Pipeline / Actividad — el CRM DE LA VITAMINA. Las empresas que la
    //    agencia quiere sumar como clientes. Es de dirección comercial.
    //
    // El "pipeline" es el recorrido por etapas de las oportunidades (nuevo → calificado →
    // propuesta → negociación → ganado/perdido); los prospectos son quienes entran a él.
    { label: 'Contactos de campañas', path: '/crm/contacts', icon: '🙋', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'Prospectos', path: '/crm/leads', icon: '🌱', roles: ['admin', 'commercial_director'] },
    { label: 'Pipeline de oportunidades', path: '/crm/opportunities', icon: '🧭', roles: ['admin', 'commercial_director'] },
    { label: 'Actividad comercial', path: '/crm/interactions', icon: '☎️', roles: ['admin', 'commercial_director'] },
  ],
  routes: [],
});
