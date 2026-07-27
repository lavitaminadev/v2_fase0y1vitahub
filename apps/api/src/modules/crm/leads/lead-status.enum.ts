import type { LeadStatus as SharedLeadStatus } from '@vitahub/shared';

/**
 * Estados de un lead.
 *
 * `class-validator` necesita un enum de TypeScript para `@IsEnum`, por lo que los valores se
 * declaran aquí y la verificación de más abajo garantiza que coincidan con el catálogo
 * compartido en ambas direcciones.
 */
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  MEETING_SCHEDULED = 'meeting_scheduled',
  QUOTE_SENT = 'quote_sent',
  NEGOTIATION = 'negotiation',
  // Resultados del ciclo de reserva: los escribe el flujo de reservas, no el equipo.
  RESERVED = 'reserved',
  ATTENDED = 'attended',
  NO_SHOW = 'no_show',
  WON = 'won',
  LOST = 'lost',
}

/**
 * Verificación mutua contra `@vitahub/shared`.
 *
 * Falla la compilación si el enum y el catálogo compartido dejan de contener exactamente los
 * mismos valores. La comprobación es en ambos sentidos a propósito: un subconjunto satisface
 * al tipo, de modo que una sola dirección no detectaría un valor faltante.
 */
type EnumMatchesShared = `${LeadStatus}` extends SharedLeadStatus
  ? SharedLeadStatus extends `${LeadStatus}` ? true : never
  : never;
const _leadStatusMatchesShared: EnumMatchesShared = true;
void _leadStatusMatchesShared;
