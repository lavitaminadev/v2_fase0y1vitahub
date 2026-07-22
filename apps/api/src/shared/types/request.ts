import type { Request } from 'express';
import type { UserRole } from '@vitahub/shared';

/**
 * Authenticated user attached to the request by the JWT strategy.
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
 * Express request extended with the authenticated user and resolved tenant.
 *
 * Use this instead of `Request` in controllers/guards that require auth.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  /** Resolved tenant id. Always present for authenticated requests. */
  organizationId: string;
}
