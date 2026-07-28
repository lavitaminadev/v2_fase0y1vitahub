/**
 * @fileoverview Alcance de fase: interruptor único que decide qué módulos de la plataforma
 * están visibles.
 *
 * VITAHUB tiene construidos muchos más módulos de los que entran en el alcance de Fase 0 y 1.
 * Mostrarlos todos convierte el menú en un inventario de trabajo en curso: el usuario no puede
 * distinguir lo que el producto hace hoy de lo que hará más adelante.
 *
 * Este archivo concentra esa decisión en un solo lugar. Lo consumen tanto la navegación
 * (`navigation.registry.ts`) como los widgets del dashboard (`DashboardPage.tsx`), de modo que un
 * módulo fuera de alcance desaparece de ambos a la vez y para todos los roles, sin excepción.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *  PARA REACTIVAR TODA LA PLATAFORMA
 *  Poner `PHASE_SCOPE_ENABLED = false`. Eso restituye todos los módulos para todos los usuarios,
 *  sin tocar ningún otro archivo, sin migraciones y sin recompilar el backend.
 *
 *  PARA ACTIVAR UN MÓDULO SUELTO
 *  Mover su clave desde `OUT_OF_SCOPE_MODULES` hacia `PHASE_1_MODULES`.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * El filtro es de presentación: no reemplaza los permisos ni las capacidades por empresa, que
 * siguen resolviéndose en el backend. Un módulo dentro del alcance puede seguir estando oculto
 * para un usuario que no tenga permiso sobre él.
 */

/**
 * Interruptor maestro. En `true` solo se muestran los módulos de `PHASE_1_MODULES`.
 *
 * Ponerlo en `false` devuelve la plataforma completa a todos los usuarios.
 */
export const PHASE_SCOPE_ENABLED = true;

/**
 * Módulos que entran en el alcance de Fase 0 y 1.
 *
 * El criterio es el circuito que el producto cierra hoy: una reserva llega desde una campaña,
 * queda registrada, se marca su asistencia y esa asistencia vuelve a Meta y Google como
 * conversión. Todo lo que ese circuito necesita está acá; lo demás espera su fase.
 *
 * Las claves coinciden con `ORGANIZATION_FEATURE_KEYS` del backend y con el mapa `PATH_FEATURE`
 * de `navigation.registry.ts`.
 */
export const PHASE_1_MODULES: readonly string[] = [
  // Circuito de reservas y conversiones
  'reservations', // Reservas, páginas públicas, agenda y bloqueos
  'crm', // Contactos de campañas (audiencia del local)
  'integrations', // Meta y Google: pixel, CAPI, cola de conversiones

  // Soporte imprescindible del circuito
  'dashboard', // Inicio
  'clients', // Cuentas: capacidades, pixel y configuración por empresa
  'reports', // Resultados de reservas y asistencia
  'users', // Altas y roles
  'settings', // Configuración de la organización
];

/**
 * Módulos construidos pero fuera del alcance de Fase 0 y 1.
 *
 * Se listan de forma explícita, en vez de deducirlos por descarte, para que quede escrito qué
 * existe y por qué no se muestra todavía. La mayoría pertenece a la operación de agencia de
 * La Vitamina —producción de contenido, aprobaciones, facturación— y no al producto VITAHUB
 * que se vende a un restaurante.
 */
export const OUT_OF_SCOPE_MODULES: Readonly<Record<string, string>> = {
  commercialPipeline: 'CRM comercial: prospectos, oportunidades y actividad de venta',
  production: 'Producción de piezas',
  content: 'Calendario de contenido',
  audiovisual: 'Producción audiovisual',
  approvals: 'Aprobaciones de piezas',
  briefs: 'Briefs de campaña',
  documents: 'Documentos',
  meetings: 'Reuniones',
  billing: 'Facturación',
  contracts: 'Contratos',
  catalog: 'Catálogo y cotizaciones',
  gamification: 'Gamificación del equipo',
  knowledge: 'Base de conocimiento',
  onboarding: 'Onboarding de clientes',
  direction: 'Dirección y objetivos',
  operations: 'Operaciones internas',
  governance: 'Gobernanza',
  udBudget: 'Unidades de dedicación',
};

/** Búsqueda O(1) sobre el alcance vigente. */
const IN_SCOPE = new Set(PHASE_1_MODULES);

/**
 * Indica si un módulo entra en el alcance vigente.
 *
 * Un módulo desconocido se considera dentro del alcance: registrar una feature nueva nunca debe
 * hacerla desaparecer del menú sin que nadie lo note. Para ocultarla hay que decirlo acá.
 *
 * @param module - Clave del módulo, o `undefined` si la ruta no depende de ninguno.
 * @returns `true` si el módulo debe mostrarse.
 */
export function isModuleInPhaseScope(module?: string): boolean {
  if (!PHASE_SCOPE_ENABLED) return true;
  if (!module) return true;
  if (IN_SCOPE.has(module)) return true;
  return !(module in OUT_OF_SCOPE_MODULES);
}
