import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANCY_KEY } from './skip-tenancy.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { tenantContext } from './tenant-context';

/**
 * Guard that ensures a user can only access resources belonging to their
 * tenant (organization). Cross-tenant endpoints must opt out explicitly.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipsTenancy = this.reflector.getAllAndOverride<boolean>(SKIP_TENANCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipsTenancy || isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = req;
    const orgId = req.organizationId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const effectiveOrgId = orgId || user.organizationId;

    if (user.organizationId !== effectiveOrgId) {
      throw new ForbiddenException('Organization access denied');
    }

    req.organizationId = effectiveOrgId;
    const store = tenantContext.getStore();
    if (store) store.organizationId = effectiveOrgId;

    return true;
  }
}
