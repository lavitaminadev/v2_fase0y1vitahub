import type { WorkflowStep } from './workflow-template.entity';

export const WORKFLOW_DEFAULTS: Record<string, { name: string; description: string; steps: WorkflowStep[] }> = {
  onboarding: {
    name: 'Activación de cliente',
    description: 'Desde el cierre comercial hasta la primera operación mensual activa.',
    steps: [
      ['brief_sent', 'Brief enviado', 'operations_director', 24],
      ['brief_received', 'Brief recibido', 'community_manager', 72],
      ['whatsapp_group', 'Grupo WhatsApp creado', 'community_manager', 8],
      ['cm_assigned', 'CM asignada', 'operations_director', 8],
      ['strategy', 'Estrategia en desarrollo', 'creative_director', 72],
      ['strategy_approved', 'Estrategia aprobada', 'creative_director', 24],
      ['handoff', 'Traspaso a CM', 'operations_director', 8],
      ['client_presentation', 'Presentación al cliente', 'community_manager', 48],
      ['month_one', 'Parrilla mes 1 y moodboard', 'community_manager', 72],
      ['active', 'Operación activa', 'operations_director', 8],
    ].map(([key, label, responsibleRole, slaHours]) => ({ key: String(key), label: String(label), responsibleRole: String(responsibleRole), slaHours: Number(slaHours), required: true })),
  },
  production: {
    name: 'Producción de piezas',
    description: 'Estados protegidos desde backlog hasta publicación.',
    steps: ['Backlog', 'Asignada', 'En progreso', 'Revisión interna', 'Validación del cliente', 'Corrección', 'Aprobada', 'Entregada o publicada'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
  audiovisual: {
    name: 'Producción audiovisual',
    description: 'Preparación creativa, sesión, edición y entrega final.',
    steps: ['Moodboard CM', 'Verificación creativa', 'Revisión dirección AV', 'Equipo asignado', 'Sesión realizada', 'Edición y revisión', 'Entrega final'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
  monthly_cycle: {
    name: 'Ciclo mensual de cuenta',
    description: 'Planificación, producción, publicación, reunión y resultados.',
    steps: ['Planificación de parrilla', 'Revisión creativa', 'Producción y publicación', 'Reunión estratégica', 'Reporte de resultados'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
};
