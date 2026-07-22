import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant-context';
import type { AuthenticatedRequest } from '../../shared/types/request';

/** Routes that do not require tenant resolution. */
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];

/**
 * Middleware that resolves the tenant from the request and runs the rest of
 * the pipeline inside an AsyncLocalStorage context.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const isPublic = PUBLIC_ROUTES.some((route) => req.path.startsWith(route));
    if (isPublic) {
      return next();
    }

    const authReq = req as AuthenticatedRequest;
    const orgId = (req.headers['x-organization-id'] as string | undefined) || authReq.user?.organizationId;

    if (orgId) {
      authReq.organizationId = orgId;
    }

    // Passport populates req.user after middleware. Keep the async context alive
    // so TenantGuard can safely fill it once the JWT has been validated.
    return tenantContext.run({ organizationId: orgId }, () => next());
  }
}
