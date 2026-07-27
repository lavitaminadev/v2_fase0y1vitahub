import { IsObject, IsNotEmptyObject } from 'class-validator';
import { ORGANIZATION_FEATURE_KEYS, OrganizationFeatures, isOrganizationFeatureKey } from '../organization-features';

/**
 * Cambio parcial de modulos habilitados: solo se envian las claves que se quieren mover.
 *
 * La validacion rechaza claves desconocidas en vez de ignorarlas, para que un error de
 * escritura no se traduzca en un modulo que silenciosamente sigue apagado.
 */
export class UpdateOrganizationFeaturesDto {
  @IsObject()
  @IsNotEmptyObject()
  features: Partial<OrganizationFeatures>;

  static validateKeys(features: Record<string, unknown>): string[] {
    return Object.keys(features).filter((key) => !isOrganizationFeatureKey(key));
  }

  static get allowedKeys(): readonly string[] {
    return ORGANIZATION_FEATURE_KEYS;
  }
}
