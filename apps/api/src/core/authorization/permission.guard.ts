import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { REQUIRES_PERMISSION_KEY, RequiredPermission } from './requires-permission.decorator';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * Aplica los permisos declarados con `@RequiresPermission`.
 *
 * Los endpoints sin ese decorador pasan sin consultar nada, de modo que el guard puede
 * registrarse de forma global y la adopción avanzar endpoint por endpoint.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const required = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRES_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const organizationId: string | undefined = request.organizationId ?? request.user?.organizationId;
    const user = request.user;
    if (!organizationId || !user?.id || !user?.role) {
      throw new ForbiddenException('No se pudo determinar el usuario o la organización de la petición');
    }

    const allowed = await this.permissions.can(organizationId, user.id, user.role, required.module, required.level);
    if (!allowed) throw new ForbiddenException('No tienes acceso a este módulo');
    return true;
  }
}
