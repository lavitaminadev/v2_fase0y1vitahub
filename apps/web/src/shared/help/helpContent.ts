export interface HelpSection {
  id: string;
  title: string;
  description?: string;
  items?: HelpItem[];
}

export interface HelpItem {
  id: string;
  label: string;
  description: string;
  formula?: string;
  source?: string;
}

export const helpRegistry: Record<string, { title: string; description: string; sections: HelpSection[] }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Centro de control con metricas clave de tu operacion.',
    sections: [
      { id: 'kpis', title: 'Indicadores principales', description: 'Clientes activos, piezas pendientes, XP del equipo y UD del mes. Reflejan la salud operativa actual.', items: [
        { id: 'xp', label: 'XP del Equipo', description: 'Puntos de experiencia acumulados por entregas a tiempo y calidad. Motiva al equipo con gamificacion.', formula: 'XP base + bonus por velocidad + bonus por calidad' },
        { id: 'ud', label: 'UD (Unidades de Dedicacion)', description: 'Unidad que mide el esfuerzo de diseño. Cada pieza consume UD segun su tipo.', formula: 'Contratadas - Consumidas = Disponibles' },
      ]},
      { id: 'performance', title: 'Rendimiento digital', description: 'Datos de Meta y Google consolidados de los ultimos 30 dias.', items: [
        { id: 'ctr', label: 'CTR (Click Through Rate)', description: 'Porcentaje de personas que hicieron clic en el anuncio respecto a las que lo vieron.', formula: 'Clics / Impresiones x 100', source: 'Meta Ads y Google Ads' },
        { id: 'cpl', label: 'CPL (Costo por Lead)', description: 'Costo promedio de conseguir un lead. Mide la eficiencia de la inversion.', formula: 'Inversion total / Leads generados', source: 'Meta Ads y Google Ads' },
      ]},
      { id: 'pieces', title: 'Estado de piezas', description: 'Distribucion de piezas segun su etapa en el flujo de produccion. Detecta cuellos de botella.' },
      { id: 'flow', title: 'Ciclo Maestro', description: 'Flujo operativo completo: desde la captacion del lead hasta la medicion de resultados.' },
    ],
  },
  crm: {
    title: 'CRM',
    description: 'Gestion de contactos, leads y oportunidades comerciales.',
    sections: [
      { id: 'contacts', title: 'Contactos', description: 'Personas que llegaron desde las agendas de reserva. Filtrables por cliente y estado de asistencia.', items: [
        { id: 'status', label: 'Estados de contacto', description: 'Nuevo: sin interaccion. Reservo: hizo una reserva. Asistio: confirmo presencia. No asistio: no se presento.' },
      ]},
      { id: 'leads', title: 'Leads', description: 'Prospectos captados desde campañas de Meta. Cada lead se asocia a un cliente.', items: [
        { id: 'source', label: 'Origen del lead', description: 'Puede ser Meta Lead Ads, formulario web, referral o manual.', source: 'Meta Ads y formularios' },
      ]},
      { id: 'opportunities', title: 'Oportunidades', description: 'Pipeline comercial con etapas: nuevo, calificado, propuesta, negociacion, ganado, perdido.', items: [
        { id: 'pipeline', label: 'Pipeline', description: 'Valor total de oportunidades en cada etapa. Permite proyectar ingresos futuros.', formula: 'Suma de amounts por etapa' },
      ]},
    ],
  },
  integrations: {
    title: 'Integraciones',
    description: 'Conexion con plataformas externas: Meta, Google y Cloudinary.',
    sections: [
      { id: 'meta', title: 'Meta (Facebook/Instagram)', description: 'Pixel para seguimiento de conversiones y CAPI para enviar eventos al servidor.', items: [
        { id: 'pixel', label: 'Pixel de Meta', description: 'Codigo que se instala en la pagina de reserva para rastrear visitas y conversiones.' },
        { id: 'capi', label: 'Conversions API (CAPI)', description: 'Envia eventos de reserva y asistencia directamente al servidor de Meta, sin depender del navegador.' },
        { id: 'token', label: 'Token de acceso', description: 'Clave que autoriza a VITAHUB a enviar eventos en nombre de tu cuenta. Se genera en Events Manager.' },
      ]},
      { id: 'google', title: 'Google', description: 'Conexion con Google Ads, Analytics, Calendar y Drive.', items: [
        { id: 'gads', label: 'Google Ads', description: 'Permite importar metricas de campañas para el dashboard.' },
        { id: 'gdrive', label: 'Google Drive', description: 'Carpeta compartida para almacenar documentos de clientes.' },
      ]},
      { id: 'cloudinary', title: 'Cloudinary', description: 'Servicio de imagenes para logos y fondos de formularios de reserva.' },
    ],
  },
  production: {
    title: 'Produccion',
    description: 'Gestion visual del flujo de piezas: backlog, asignacion, revision y entrega.',
    sections: [
      { id: 'workflow', title: 'Flujo de trabajo', description: 'Backlog -> Asignado -> En progreso -> Revision interna -> Validacion cliente -> Correcciones -> Aprobado -> Entregado.' },
      { id: 'naming', title: 'Nomenclatura de archivos', description: 'Los archivos deben seguir la convencion: Cliente_TipoPieza_Descripcion_Version.extension', items: [
        { id: 'format', label: 'Formato', description: 'CasaNativa_Carrusel_MenuTemporada_v1.pdf', formula: 'Cliente_Tipo_Descripcion_vN.extension' },
      ]},
    ],
  },
  reservations: {
    title: 'Reservas',
    description: 'Formularios de reserva publicos con Pixel de Meta integrado.',
    sections: [
      { id: 'forms', title: 'Formularios', description: 'Crea formularios con campos arrastrables. Cada formulario tiene un enlace publico unico.' },
      { id: 'bookings', title: 'Reservas', description: 'Lista de reservas recibidas. Marca asistencia con un clic para enviar la señal a Meta.', items: [
        { id: 'attendance', label: 'Asistencia', description: 'Al marcar Asistio se envia un evento de alto valor a Meta que mejora la optimizacion de campañas.' },
      ]},
      { id: 'availability', title: 'Disponibilidad', description: 'Configura horarios semanales, bloquea dias o franjas, y define el tope diario de reservas.' },
    ],
  },
  settings: {
    title: 'Ajustes',
    description: 'Configuracion de la organizacion: identidad, accesos, integraciones y preferencias.',
    sections: [
      { id: 'org', title: 'Organizacion', description: 'Nombre, codigo, moneda y configuracion base de tu empresa en VITAHUB.' },
      { id: 'access', title: 'Usuarios y accesos', description: 'Crea cuentas, asigna roles y controla quien accede a cada modulo.' },
    ],
  },
};

export function getHelpForModule(module: string) {
  return helpRegistry[module] ?? {
    title: module,
    description: 'Ayuda no disponible para este modulo todavia.',
    sections: [{ id: 'pending', title: 'En construccion', description: 'El contenido de ayuda para esta seccion esta en desarrollo.' }],
  };
}
