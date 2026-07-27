/**
 * Modulos que se pueden encender o apagar por organizacion.
 *
 * Es el eje "¿esta fase esta habilitada?", distinto de dos cosas con las que se confunde:
 *
 * - `clients.capabilities` responde "¿este cliente lo tiene contratado?"
 * - los permisos por rol responden "¿esta persona puede verlo?"
 *
 * Un modulo apagado aca no lo ve nadie, ni un administrador: es la forma de congelar una
 * fase sin borrar el codigo que ya se construyo. Las tres condiciones se evaluan en cadena
 * y esta es la primera.
 *
 * Encender la Fase 2 el dia que Meta apruebe `ads_read` es cambiar un valor a `true`, sin
 * desplegar.
 */
export const ORGANIZATION_FEATURE_KEYS = [
  // Fase 0 y 1 — el alcance vigente
  'dashboard',
  'clients',
  'users',
  'reservations',
  'crm',
  'integrations',
  'settings',

  // Fase 2 — panel de resultados del cliente (requiere ads_read aprobado)
  'clientMetricsPanel',

  // Fase 3 — escala multi-cliente
  'multiClientOnboarding',

  // Fase 4 — resto del sistema de operaciones
  'production',
  'udBudget',
  'gamification',
  'billing',
  'contracts',
  'catalog',
  'content',
  'briefs',
  'meetings',
  'documents',
  'approvals',
  'audiovisual',
  'knowledge',
  'reports',
  'onboarding',
  'operations',
  'governance',
  'direction',
  'commercialPipeline',
] as const;

export type OrganizationFeatureKey = (typeof ORGANIZATION_FEATURE_KEYS)[number];
export type OrganizationFeatures = Record<OrganizationFeatureKey, boolean>;

/**
 * Por defecto solo queda encendido el alcance de Fase 0 y 1. Todo lo demas existe en el
 * codigo pero permanece apagado hasta que se decida activarlo, para que el sistema no
 * muestre veinte pantallas cuando lo acordado son cuatro.
 */
export const DEFAULT_ORGANIZATION_FEATURES: OrganizationFeatures = {
  dashboard: true,
  clients: true,
  users: true,
  reservations: true,
  crm: true,
  integrations: true,
  settings: true,

  clientMetricsPanel: false,
  multiClientOnboarding: false,

  production: false,
  udBudget: false,
  gamification: false,
  billing: false,
  contracts: false,
  catalog: false,
  content: false,
  briefs: false,
  meetings: false,
  documents: false,
  approvals: false,
  audiovisual: false,
  knowledge: false,
  reports: false,
  onboarding: false,
  operations: false,
  governance: false,
  direction: false,
  commercialPipeline: false,
};

/** Rellena las claves ausentes con el valor por defecto y descarta las desconocidas. */
export function normalizeOrganizationFeatures(value?: Partial<OrganizationFeatures> | null): OrganizationFeatures {
  const result = { ...DEFAULT_ORGANIZATION_FEATURES };
  for (const key of ORGANIZATION_FEATURE_KEYS) {
    const provided = value?.[key];
    if (typeof provided === 'boolean') result[key] = provided;
  }
  return result;
}

export function isOrganizationFeatureKey(value: string): value is OrganizationFeatureKey {
  return (ORGANIZATION_FEATURE_KEYS as readonly string[]).includes(value);
}
