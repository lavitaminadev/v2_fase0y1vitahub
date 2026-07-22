import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../shared/types/request';

/**
 * Injects the authenticated user (or a single property) into a route handler.
 *
 * @example
 * async me(@CurrentUser() user: AuthUser) { ... }
 * async org(@CurrentUser('organizationId') organizationId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedRequest['user'] | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
