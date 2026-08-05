import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { REQUIRES_PERMISSION_KEY, RequiredPermission } from './requires-permission.decorator';
import { MODULE_EXEMPT_KEY, MODULE_SCOPE_KEY } from './module-scope.decorator';
import { REQUIRES_FEATURE_KEY } from './requires-feature.decorator';
import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionLevel } from './permission-level';

/**
 * Nivel que exige cada verbo cuando el endpoint no declara uno propio.
 *
 * Consultar exige `view`, crear o modificar exige `edit`, y borrar exige `manage` porque es
 * la única operación que no admite corrección posterior.
 */
const LEVEL_BY_METHOD: Record<string, PermissionLevel> = {
  GET: 'view',
  HEAD: 'view',
  OPTIONS: 'view',
  POST: 'edit',
  PUT: 'edit',
  PATCH: 'edit',
  DELETE: 'manage',
};

/**
 * Aplica los permisos configurados sobre cada endpoint autenticado.
 *
 * El módulo se toma, en este orden, de `@RequiresPermission`, `@ModuleScope` o
 * `@RequiresFeature`; el nivel, del propio `@RequiresPermission` o del verbo HTTP.
 *
 * Un endpoint que no declara módulo ni exención se rechaza. Negar por omisión es lo que
 * hace que la pantalla de permisos gobierne de verdad: mientras lo no anotado pasaba libre,
 * quitarle un módulo a una persona ocultaba su menú pero la API le seguía respondiendo.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets: [Function, Function] = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<string>(MODULE_EXEMPT_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const organizationId: string | undefined = request.organizationId ?? request.user?.organizationId;
    const user = request.user;
    if (!organizationId || !user?.id || !user?.role) {
      throw new ForbiddenException('No se pudo determinar el usuario o la organización de la petición');
    }

    const required = this.resolveRequirement(context, targets);
    if (!required) {
      // Un endpoint sin módulo declarado es un descuido de programación, no una decisión de
      // producto. Se registra con su ruta para que aparezca en los registros de la
      // aplicación en vez de quedar como un 403 sin explicación.
      this.logger.error(`Endpoint sin módulo declarado: ${request.method} ${request.url}`);
      throw new ForbiddenException('Este endpoint no tiene módulo declarado');
    }

    const allowed = await this.permissions.can(organizationId, user.id, user.role, required.module, required.level);
    if (!allowed) throw new ForbiddenException('No tienes acceso a este módulo');
    return true;
  }

  /** Módulo y nivel exigidos por el endpoint, o `undefined` si no declara ninguno. */
  private resolveRequirement(context: ExecutionContext, targets: [Function, Function]): RequiredPermission | undefined {
    const explicit = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRES_PERMISSION_KEY, targets);
    if (explicit) return explicit;

    const module = this.reflector.getAllAndOverride<OrganizationFeatureKey>(MODULE_SCOPE_KEY, targets)
      ?? this.reflector.getAllAndOverride<OrganizationFeatureKey>(REQUIRES_FEATURE_KEY, targets);
    if (!module) return undefined;

    const method = context.switchToHttp().getRequest().method as string;
    return { module, level: LEVEL_BY_METHOD[method] ?? 'manage' };
  }
}
