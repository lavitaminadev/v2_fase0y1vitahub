/**
 * @fileoverview Route guard that restricts access to client portal routes.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';

/**
 * Props for the client route guard.
 */
export interface ClientRouteProps {
  /** Child route element(s) to render when the user is a client. */
  children: React.ReactNode;
}

/**
 * Wraps routes that are only available to users with the `client` role.
 */
export function ClientRoute({ children }: ClientRouteProps): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'client') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
