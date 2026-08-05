import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Persiste el dominio del lead (`audience` vs `commercial`) que hasta ahora solo existía
 * como parámetro efímero de `LeadIntakeService`, descartado antes de guardar (ver
 * `splitDomain` en lead-intake.service.ts). Sin esta columna, toda consulta sobre `leads`
 * que no filtrara por `source` a mano mezclaba comensales de reserva con prospectos
 * comerciales de la agencia en el mismo resultado — confirmado en auditoría de solo
 * lectura, no es un riesgo hipotético.
 *
 * El backfill usa el mismo criterio que ya aplica `CrmLeadAutomationService.isAudienceLead`
 * (`source = 'vitahub_reservations'`), así que no reclasifica nada que el sistema no
 * tratara ya como audiencia.
 */
export class LeadDomain1725500000000 implements MigrationInterface {
  name = 'LeadDomain1725500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('leads', 'domain'))) {
      await queryRunner.addColumn('leads', new TableColumn({
        name: 'domain',
        type: 'varchar',
        length: '20',
        default: "'commercial'",
        isNullable: false,
      }));
    }

    await queryRunner.query(`UPDATE leads SET domain = 'audience' WHERE source = 'vitahub_reservations'`);

    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'leads' AND index_name = 'IDX_leads_org_domain'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) === 0) {
      await queryRunner.query('CREATE INDEX IDX_leads_org_domain ON leads (organization_id, domain)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'leads' AND index_name = 'IDX_leads_org_domain'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) > 0) {
      await queryRunner.query('DROP INDEX IDX_leads_org_domain ON leads');
    }
    if (await queryRunner.hasColumn('leads', 'domain')) {
      await queryRunner.dropColumn('leads', 'domain');
    }
  }
}
