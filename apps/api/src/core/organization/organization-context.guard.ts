import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { organizationContext } from './organization-context';

/**
 * Fija la organización de la petición a partir del usuario autenticado.
 *
 * VITAHUB opera una sola organización: La Vitamina. La columna `organization_id` se
 * conserva en el modelo, pero no es algo que el cliente pueda elegir — se deriva del JWT ya
 * verificado y de ninguna otra fuente.
 *
 * Debe registrarse después de `JwtAuthGuard` para que `req.user` exista. En rutas públicas
 * no hay usuario y la organización queda sin resolver: esos endpoints la determinan por sí
 * mismos (el slug del formulario, `AGENCY_ORGANIZATION_ID`), que es la única forma de que
 * un endpoint sin autenticar no escriba donde no debe.
 */
@Injectable()
export class OrganizationContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = req.user?.organizationId;
    if (!organizationId) return true;

    req.organizationId = organizationId;
    const store = organizationContext.getStore();
    if (store) store.organizationId = organizationId;
    return true;
  }
}
