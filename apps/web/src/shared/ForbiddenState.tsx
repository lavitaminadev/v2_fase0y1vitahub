/**
 * @fileoverview Estado mostrado dentro de una vista cuando la API responde
 * 403: el usuario está autenticado pero su rol no tiene permiso para ver el
 * recurso. Distinto de `ProtectedRoute`, que bloquea a nivel de ruta antes de
 * montar la página — este componente cubre el caso en que la ruta es
 * accesible pero una query específica dentro de ella no lo es.
 */

import { Link } from 'react-router-dom';
import { memo, type JSX } from 'react';

/**
 * Props del componente de estado sin permisos.
 */
export interface ForbiddenStateProps {
  /** Título breve. */
  title?: string;
  /** Mensaje descriptivo. */
  description?: string;
}

/**
 * Renderiza un mensaje de "no tienes permiso para ver esto" con un enlace de
 * salida a home.
 */
export const ForbiddenState = memo(function ForbiddenState({
  title = 'No tienes permiso para ver esto',
  description = 'Tu rol no tiene acceso a esta información. Si crees que es un error, contacta a quien administra tu cuenta.',
}: ForbiddenStateProps): JSX.Element {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-state-icon" aria-hidden="true">
        🔒
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="btn btn-primary btn-sm" to="/">Ir al inicio</Link>
    </div>
  );
});
