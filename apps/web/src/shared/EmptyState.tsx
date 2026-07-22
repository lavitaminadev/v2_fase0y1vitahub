/**
 * @fileoverview Empty state component used across list and detail views.
 */

import { memo, type JSX, type ReactNode } from 'react';

/**
 * Props for the empty state component.
 */
export interface EmptyStateProps {
  /** Plain-text icon or symbol shown above the message. */
  icon?: string;
  /** Short title. */
  title?: string;
  /** Descriptive message. */
  description?: string;
  /** Optional action element (button, link, etc.). */
  action?: ReactNode;
}

/**
 * Renders a friendly empty state message.
 */
export const EmptyState = memo(function EmptyState({
  icon = '[]',
  title = 'Sin datos',
  description = 'No hay información disponible aún.',
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
});
