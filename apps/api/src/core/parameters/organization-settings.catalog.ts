export type OrganizationSettingCategory =
  | 'operation'
  | 'production'
  | 'design_budget'
  | 'meetings'
  | 'alerts'
  | 'documents';

export type OrganizationSettingValueType = 'boolean' | 'number' | 'select' | 'text';
export type MasterSettingStatus = 'master_defined' | 'direction_required';

export interface OrganizationSettingOption {
  value: string;
  label: string;
}

export interface OrganizationSettingDefinition {
  key: string;
  category: OrganizationSettingCategory;
  label: string;
  description: string;
  valueType: OrganizationSettingValueType;
  defaultValue: string | number | boolean | null;
  masterStatus: MasterSettingStatus;
  options?: OrganizationSettingOption[];
  min?: number;
  max?: number;
  unit?: string;
  nullable?: boolean;
}

export const ORGANIZATION_SETTINGS: readonly OrganizationSettingDefinition[] = [
  {
    key: 'operation.assignment_mode',
    category: 'operation',
    label: 'Modelo de asignación',
    description: 'Define si las cuentas se coordinan por responsable individual, pod o un esquema híbrido.',
    valueType: 'select',
    defaultValue: 'individual',
    masterStatus: 'direction_required',
    options: [
      { value: 'individual', label: 'Responsable individual' },
      { value: 'pod', label: 'Pod por cuenta' },
      { value: 'hybrid', label: 'Modelo híbrido' },
    ],
  },
  {
    key: 'production.stale_hours',
    category: 'production',
    label: 'Alerta por pieza sin movimiento',
    description: 'Activa una alerta cuando una pieza en curso supera este tiempo sin cambios.',
    valueType: 'number',
    defaultValue: 48,
    masterStatus: 'master_defined',
    min: 1,
    max: 168,
    unit: 'horas',
  },
  {
    key: 'production.max_client_corrections',
    category: 'production',
    label: 'Correcciones incluidas',
    description: 'Las solicitudes del cliente que superen esta cantidad quedan marcadas como cobrables.',
    valueType: 'number',
    defaultValue: 3,
    masterStatus: 'master_defined',
    min: 0,
    max: 10,
    unit: 'rondas',
  },
  {
    key: 'production.client_validation_months',
    category: 'production',
    label: 'Meses con validación del cliente',
    description: 'Periodo inicial sugerido para mantener la aprobación externa antes de automatizar el flujo.',
    valueType: 'number',
    defaultValue: 3,
    masterStatus: 'direction_required',
    min: 0,
    max: 24,
    unit: 'meses',
  },
  {
    key: 'ud.warning_threshold_percent',
    category: 'design_budget',
    label: 'Aviso de consumo UD',
    description: 'Muestra estado preventivo cuando el consumo alcanza este porcentaje del presupuesto.',
    valueType: 'number',
    defaultValue: 80,
    masterStatus: 'direction_required',
    min: 50,
    max: 100,
    unit: '%',
  },
  {
    key: 'ud.limit_action',
    category: 'design_budget',
    label: 'Acción al superar UD',
    description: 'Controla si una reserva sin saldo se bloquea o continúa dejando el presupuesto excedido.',
    valueType: 'select',
    defaultValue: 'block',
    masterStatus: 'direction_required',
    options: [
      { value: 'block', label: 'Bloquear reserva' },
      { value: 'warn', label: 'Advertir y continuar' },
    ],
  },
  {
    key: 'ud.client_visibility',
    category: 'design_budget',
    label: 'Visibilidad de UD para clientes',
    description: 'Registra la política de acceso al saldo UD desde el portal de cada cuenta.',
    valueType: 'boolean',
    defaultValue: false,
    masterStatus: 'direction_required',
  },
  {
    key: 'ud.display_name',
    category: 'design_budget',
    label: 'Nombre visible del presupuesto',
    description: 'Define el término que verá el equipo al comunicar el presupuesto de diseño.',
    valueType: 'select',
    defaultValue: 'UD',
    masterStatus: 'direction_required',
    options: [
      { value: 'UD', label: 'UD' },
      { value: 'Créditos de Diseño', label: 'Créditos de Diseño' },
    ],
  },
  {
    key: 'ud.internal_cost',
    category: 'design_budget',
    label: 'Costo interno por UD',
    description: 'Valor interno de referencia; nunca se expone en el portal del cliente.',
    valueType: 'number',
    defaultValue: null,
    masterStatus: 'direction_required',
    min: 0,
    max: 10000000,
    unit: 'CLP',
    nullable: true,
  },
  {
    key: 'meetings.weekly_duration_minutes',
    category: 'meetings',
    label: 'Duración de reunión semanal',
    description: 'Duración base recomendada para la reunión operativa de seguimiento.',
    valueType: 'number',
    defaultValue: 30,
    masterStatus: 'master_defined',
    min: 15,
    max: 120,
    unit: 'minutos',
  },
  {
    key: 'alerts.deadline_notice_hours',
    category: 'alerts',
    label: 'Anticipación de vencimientos',
    description: 'Tiempo de anticipación registrado para comunicar entregas próximas.',
    valueType: 'number',
    defaultValue: 24,
    masterStatus: 'direction_required',
    min: 1,
    max: 168,
    unit: 'horas',
  },
  {
    key: 'documents.naming_pattern',
    category: 'documents',
    label: 'Convención de nombres',
    description: 'Patrón oficial para archivos entregables y trazabilidad de versiones.',
    valueType: 'text',
    defaultValue: 'CLIENTE_TIPO-PIEZA_FORMATO_vVERSIÓN_ESTADO',
    masterStatus: 'master_defined',
  },
  {
    key: 'documents.final_immutable',
    category: 'documents',
    label: 'Finales inmutables',
    description: 'Mantiene las entregas finales protegidas; cualquier cambio requiere una nueva versión.',
    valueType: 'boolean',
    defaultValue: true,
    masterStatus: 'master_defined',
  },
] as const;

export function validateOrganizationSettingValue(
  definition: OrganizationSettingDefinition,
  value: unknown,
): string | number | boolean | null {
  if (value === null && definition.nullable) return null;

  if (definition.valueType === 'boolean') {
    if (typeof value !== 'boolean') throw new Error('debe ser verdadero o falso');
    return value;
  }

  if (definition.valueType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('debe ser un número válido');
    if (!Number.isInteger(value)) throw new Error('debe ser un número entero');
    if (definition.min !== undefined && value < definition.min) throw new Error(`no puede ser menor que ${definition.min}`);
    if (definition.max !== undefined && value > definition.max) throw new Error(`no puede ser mayor que ${definition.max}`);
    return value;
  }

  if (typeof value !== 'string') throw new Error('debe ser texto');
  const normalized = value.trim();
  if (!normalized) throw new Error('no puede estar vacío');
  if (normalized.length > 255) throw new Error('no puede superar 255 caracteres');
  if (definition.valueType === 'select' && !definition.options?.some((option) => option.value === normalized)) {
    throw new Error('contiene una opción no permitida');
  }
  return normalized;
}
