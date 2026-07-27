/**
 * @fileoverview Insignia de estado con color para estados de entidades.
 */

import { memo, type JSX } from 'react';
import { statusLabel } from './status-labels';
import { CYCLE_COLORS } from './status-palette';

/**
 * Mapea cadenas de estado conocidas a colores de visualización.
 */
const STATUS_COLORS: Record<string, string> = {
  active: '#1f7a46',
  inactive: '#596562',
  disabled: '#596562',
  disconnected: '#596562',
  archived: '#596562',
  pending: '#9a5a00',
  completed: '#1f7a46',
  approved: '#1f7a46',
  rejected: '#b5332d',
  scheduled: '#1f6fb2',
  strategic: '#176f63',
  weekly: '#176f63',
  onboarding: '#7040a0',
  paused: '#9a5a00',
  error: '#b5332d',
  review: '#1f6fb2',
  draft: '#596562',
  new: '#1f6fb2',
  contacted: '#9a5a00',
  meeting_scheduled: '#1f6fb2',
  quote_sent: '#7040a0',
  negotiation: '#9a5a00',
  qualified: '#7040a0',
  discarded: '#b5332d',
  converted: '#1f7a46',
  won: '#1f7a46',
  lost: '#b5332d',
  in_progress: '#1f6fb2',
  on_hold: '#9a5a00',
  // El ciclo de reserva se define en un solo lugar porque lo comparten la bandeja,
  // el CRM de contactos y esta insignia.
  ...CYCLE_COLORS,
};

/**
 * Props de la insignia de estado.
 */
export interface StatusBadgeProps {
  /** Valor de estado interno (p. ej. `in_progress`). */
  status: string;
}

/**
 * Renderiza una píldora de estado legible con un color derivado del estado.
 */
export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const color = STATUS_COLORS[status] || '#666';
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: `${color}20`, color, borderColor: color }}
    >
      {statusLabel(status)}
    </span>
  );
});
