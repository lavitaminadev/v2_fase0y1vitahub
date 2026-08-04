import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Alcance por cliente en los contactos de CRM.
 *
 * `crm_contacts` guardaba la organización pero no el cliente, de modo que los comensales de
 * todos los locales de una misma organización quedaban en una tabla común sin separación. Como
 * cada local es un cliente distinto, eso mezcla datos personales entre cuentas que no deben
 * verse entre sí, y hace imposible filtrar la audiencia por local.
 *
 * La columna es nullable a propósito: un contacto comercial —una persona dentro de una empresa
 * prospecto— no pertenece a ningún cliente, y debe poder existir sin él.
 *
 * El relleno deriva el cliente desde el lead de origen, que sí lo tiene. Los contactos sin lead,
 * o cuyo lead no tiene cliente, quedan en NULL y se comportan como hasta ahora.
 */
export class ContactClientScope1724164100000 implements MigrationInterface {
  name = 'ContactClientScope1724164100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('crm_contacts', 'client_id'))) {
      await queryRunner.addColumn('crm_contacts', new TableColumn({
        name: 'client_id',
        type: 'char',
        length: '36',
        isNullable: true,
      }));
    }

    // Relleno histórico: el cliente se hereda del lead que originó el contacto.
    // En bases locales antiguas puede existir `crm_contacts` sin `crm_leads`; en ese caso
    // la columna queda nullable y se completa cuando exista el lead/captura correspondiente.
    if (await queryRunner.hasTable('crm_leads')) {
      await queryRunner.query(`
        UPDATE crm_contacts c
        INNER JOIN crm_leads l ON l.id = c.lead_id
        SET c.client_id = l.client_id
        WHERE c.client_id IS NULL AND l.client_id IS NOT NULL
      `);
    }

    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'crm_contacts' AND index_name = 'idx_crm_contacts_org_client'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) === 0) {
      await queryRunner.query(
        'CREATE INDEX idx_crm_contacts_org_client ON crm_contacts (organization_id, client_id)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'crm_contacts' AND index_name = 'idx_crm_contacts_org_client'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) > 0) {
      await queryRunner.query('DROP INDEX idx_crm_contacts_org_client ON crm_contacts');
    }

    if (await queryRunner.hasColumn('crm_contacts', 'client_id')) {
      await queryRunner.dropColumn('crm_contacts', 'client_id');
    }
  }
}
