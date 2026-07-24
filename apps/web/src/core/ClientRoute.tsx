/**
 * @fileoverview Route guard que restringe el acceso a las rutas del portal de clientes.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';

/**
 * Props del route guard de cliente.
 */
export interface ClientRouteProps {
  /** Elemento(s) de ruta hijo a renderizar cuando el usuario es un cliente. */
  children: React.ReactNode;
}

/**
 * Envuelve rutas disponibles solo para usuarios con el rol `client`.
 */
export function ClientRoute({ children }: ClientRouteProps): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'client') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
