import type { Request } from 'express';
import type { UserRole } from '@vitahub/shared';

/**
 * Usuario autenticado adjuntado al request por la estrategia JWT.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  clientId?: string;
  tenantId: string;
}

/**
 * Request de Express extendido con el usuario autenticado y el tenant resuelto.
 *
 * Usar esto en vez de `Request` en controllers/guards que requieren autenticación.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  /** Id del tenant resuelto. Siempre presente en requests autenticados. */
  organizationId: string;
}
