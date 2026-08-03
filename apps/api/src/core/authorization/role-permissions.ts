import { UserRole } from '../../modules/organizations/user-role.enum';
import { ORGANIZATION_FEATURE_KEYS, OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { PermissionLevel } from './permission-level';

/**
 * Acceso que cada cargo tiene a cada módulo.
 *
 * Vive en código y no en base de datos porque es una definición de producto: qué puede
 * hacer un community manager es una decisión que se revisa en un cambio de código, no un
 * dato operativo. Las desviaciones para una persona concreta sí son datos y viven en
 * `user_permission_overrides`.
 *
 * Un módulo ausente en el mapa de un rol equivale a `none`.
 */
type RoleModuleMap = Partial<Record<OrganizationFeatureKey, PermissionLevel>>;

/** Módulos que todo miembro del equipo puede consultar. */
const TEAM_BASELINE: RoleModuleMap = {
  dashboard: 'view',
  settings: 'view',
};

export const ROLE_PERMISSIONS: Record<UserRole, RoleModuleMap> = {
  [UserRole.ADMIN]: Object.fromEntries(
    ORGANIZATION_FEATURE_KEYS.map((key) => [key, 'manage' as PermissionLevel]),
  ) as RoleModuleMap,

  [UserRole.COMMERCIAL_DIRECTOR]: {
    ...TEAM_BASELINE,
    clients: 'manage',
    crm: 'manage',
    commercialPipeline: 'manage',
    catalog: 'manage',
    contracts: 'manage',
    billing: 'manage',
    reports: 'view',
    reservations: 'edit',
    integrations: 'view',
    clientMetricsPanel: 'view',
    direction: 'view',
  },

  [UserRole.OPERATIONS_DIRECTOR]: {
    ...TEAM_BASELINE,
    clients: 'manage',
    users: 'manage',
    crm: 'edit',
    reservations: 'manage',
    production: 'manage',
    content: 'view',
    briefs: 'manage',
    meetings: 'manage',
    documents: 'manage',
    approvals: 'manage',
    onboarding: 'manage',
    operations: 'manage',
    governance: 'view',
    udBudget: 'view',
    reports: 'view',
    billing: 'view',
    contracts: 'view',
    integrations: 'view',
    clientMetricsPanel: 'view',
    multiClientOnboarding: 'manage',
  },

  [UserRole.CREATIVE_DIRECTOR]: {
    ...TEAM_BASELINE,
    content: 'manage',
    briefs: 'manage',
    approvals: 'manage',
    production: 'view',
    udBudget: 'view',
    reports: 'view',
    direction: 'view',
  },

  [UserRole.ART_DIRECTOR]: {
    ...TEAM_BASELINE,
    production: 'manage',
    approvals: 'manage',
    gamification: 'manage',
    udBudget: 'view',
    reports: 'view',
  },

  [UserRole.AV_DIRECTOR]: {
    ...TEAM_BASELINE,
    audiovisual: 'manage',
    production: 'view',
    gamification: 'view',
    reports: 'view',
  },

  [UserRole.AI_LEAD]: {
    ...TEAM_BASELINE,
    knowledge: 'manage',
    reports: 'view',
  },

  [UserRole.COMMUNITY_MANAGER]: {
    ...TEAM_BASELINE,
    clients: 'view',
    crm: 'edit',
    reservations: 'edit',
    content: 'manage',
    meetings: 'edit',
    documents: 'view',
    approvals: 'edit',
    production: 'view',
    reports: 'view',
  },

  [UserRole.DESIGNER]: {
    ...TEAM_BASELINE,
    production: 'edit',
    gamification: 'view',
  },

  [UserRole.AUDIOVISUAL]: {
    ...TEAM_BASELINE,
    production: 'edit',
    audiovisual: 'edit',
    gamification: 'view',
  },

  /**
   * El cliente entra por su portal, no por la aplicación interna: su acceso se limita a
   * consultar lo suyo y a validar piezas.
   */
  [UserRole.CLIENT]: {
    reservations: 'edit',
    content: 'view',
    approvals: 'edit',
    meetings: 'view',
    reports: 'view',
    clientMetricsPanel: 'view',
  },
};

/**
 * Nivel que el rol otorga sobre un módulo, sin considerar excepciones por usuario.
 *
 * @returns El nivel definido para el rol, o `'none'` si el módulo no está en su mapa.
 */
export function roleLevel(role: UserRole, module: OrganizationFeatureKey): PermissionLevel {
  return ROLE_PERMISSIONS[role]?.[module] ?? 'none';
}
