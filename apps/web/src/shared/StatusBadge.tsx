/**
 * @fileoverview Colored status badge for entity states.
 */

import { memo, type JSX } from 'react';
import { statusLabel } from './status-labels';

/**
 * Maps known status strings to display colors.
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
  qualified: '#7040a0',
  discarded: '#b5332d',
  converted: '#1f7a46',
  lost: '#b5332d',
  in_progress: '#1f6fb2',
  on_hold: '#9a5a00',
  cancelled: '#b5332d',
};

/**
 * Props for the status badge.
 */
export interface StatusBadgeProps {
  /** Machine status value (e.g. `in_progress`). */
  status: string;
}

/**
 * Renders a human-readable status pill with a color derived from the status.
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
