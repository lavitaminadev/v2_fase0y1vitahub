/**
 * @fileoverview Route guard that redirects unauthenticated users to `/login`.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { getAllowedRolesForPath } from './navigation.registry';
import type { UserRole } from '@vitahub/shared';

/**
 * Props for the protected route guard.
 */
export interface ProtectedRouteProps {
  /** Child route element(s) to render when authenticated. */
  children: React.ReactNode;
  /** Optional route path used to derive role restrictions from feature manifests. */
  path?: string;
  /** Optional explicit role allow-list. */
  allowedRoles?: UserRole[];
}

/**
 * Wraps routes that require an authenticated session.
 */
export function ProtectedRoute({ children, path, allowedRoles }: ProtectedRouteProps): JSX.Element {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && path !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (user.role === 'client' && path && !path.startsWith('/portal')) {
    return <Navigate to="/portal" replace />;
  }
  const roles = allowedRoles ?? (path ? getAllowedRolesForPath(path) : undefined);
  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/404" replace />;
  }
  return <>{children}</>;
}
