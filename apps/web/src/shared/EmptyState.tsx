/**
 * @fileoverview Componente de estado vacío usado en vistas de listado y detalle.
 */

import { memo, type JSX, type ReactNode } from 'react';

/**
 * Props del componente de estado vacío.
 */
export interface EmptyStateProps {
  /** Icono o símbolo en texto plano mostrado sobre el mensaje. */
  icon?: string;
  /** Título breve. */
  title?: string;
  /** Mensaje descriptivo. */
  description?: string;
  /** Elemento de acción opcional (botón, link, etc.). */
  action?: ReactNode;
}

/**
 * Renderiza un mensaje de estado vacío amigable.
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
