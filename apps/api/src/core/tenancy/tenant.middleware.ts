import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant-context';
import type { AuthenticatedRequest } from '../../shared/types/request';

/** Rutas que no requieren resolución de tenant. */
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];

/**
 * Middleware que resuelve el tenant a partir del request y ejecuta el resto
 * del pipeline dentro de un contexto de AsyncLocalStorage.
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

    // Passport llena req.user después del middleware. Se mantiene vivo el contexto
    // async para que TenantGuard pueda completarlo con seguridad una vez validado el JWT.
    return tenantContext.run({ organizationId: orgId }, () => next());
  }
}
