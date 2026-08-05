import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_ORGANIZATION_FEATURES,
  OrganizationFeatureKey,
} from '../../modules/organizations/organization-features';

/**
 * Módulos que pasan a estar controlados por la pantalla de permisos y que hasta ahora
 * respondían sin condición alguna.
 *
 * Sus controladores no declaraban módulo, así que el guard los dejaba pasar. Al declararlo,
 * quedan sujetos al interruptor de la organización, que en `features = NULL` resuelve al
 * valor por defecto —apagado— y los dejaría inaccesibles. Se encienden explícitamente para
 * que el control cambie sin que cambie lo que el equipo puede hacer hoy.
 */
const NEWLY_GOVERNED: OrganizationFeatureKey[] = [
  'content',
  'meetings',
  'approvals',
  'reports',
  'operations',
  'udBudget',
  'governance',
  'direction',
];

/**
 * Deja explícitos los módulos habilitados de cada organización.
 *
 * Solo toca las filas con `features` sin definir: donde alguien ya decidió qué módulos
 * quería, esa decisión manda y la migración no la pisa.
 */
export class SeedOrganizationFeatures1725700000000 implements MigrationInterface {
  name = 'SeedOrganizationFeatures1725700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'features'))) return;

    const features = { ...DEFAULT_ORGANIZATION_FEATURES };
    for (const key of NEWLY_GOVERNED) features[key] = true;

    await queryRunner.query(
      'UPDATE `organizations` SET `features` = ? WHERE `features` IS NULL',
      [JSON.stringify(features)],
    );
  }

  /**
   * Devuelve a `NULL` únicamente las filas que quedaron exactamente con lo que sembró `up`.
   * Cualquier ajuste posterior se conserva, porque revertir una migración no debe borrar una
   * decisión que tomó una persona.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'features'))) return;

    const features = { ...DEFAULT_ORGANIZATION_FEATURES };
    for (const key of NEWLY_GOVERNED) features[key] = true;

    await queryRunner.query(
      'UPDATE `organizations` SET `features` = NULL WHERE `features` = CAST(? AS JSON)',
      [JSON.stringify(features)],
    );
  }
}
