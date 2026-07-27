import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUIRES_FEATURE_KEY } from './requires-feature.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { Organization } from '../../modules/organizations/organization.entity';
import {
  DEFAULT_ORGANIZATION_FEATURES, OrganizationFeatureKey, OrganizationFeatures,
  normalizeOrganizationFeatures,
} from '../../modules/organizations/organization-features';

/**
 * Rechaza las peticiones a modulos apagados en la organizacion.
 *
 * Los modulos habilitados cambian pocas veces al dia y se consultan en cada peticion, asi
 * que se memorizan por un rato: sin cache, cada endpoint anotado agregaria una consulta.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { features: OrganizationFeatures; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const required = this.reflector.getAllAndOverride<OrganizationFeatureKey>(REQUIRES_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const organizationId: string | undefined = request.organizationId ?? request.user?.organizationId;
    // Sin organizacion resuelta no se puede afirmar que el modulo este habilitado, y ante
    // la duda se niega: un permiso que falla abierto es peor que uno que molesta.
    if (!organizationId) throw new ForbiddenException('No se pudo determinar la organización de la petición');

    const features = await this.featuresOf(organizationId);
    if (!features[required]) throw new ForbiddenException('Este módulo no está habilitado para tu organización');
    return true;
  }

  private async featuresOf(organizationId: string): Promise<OrganizationFeatures> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) return cached.features;
    const organization = await this.organizations.findOne({ where: { id: organizationId }, select: ['id', 'features'] });
    const features = organization
      ? normalizeOrganizationFeatures(organization.features)
      : DEFAULT_ORGANIZATION_FEATURES;
    this.cache.set(organizationId, { features, expiresAt: Date.now() + FeatureGuard.CACHE_TTL_MS });
    return features;
  }

  /** Invalida la cache tras cambiar los modulos habilitados. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }
}
