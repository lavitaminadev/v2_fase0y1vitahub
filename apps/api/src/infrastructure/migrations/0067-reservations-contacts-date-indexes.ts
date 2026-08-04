import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices compuestos para las dos consultas por fecha más usadas del sistema.
 *
 * `listReservations` (listado principal y exports) filtra por organización + cliente y ordena
 * por `starts_at`; el listado de contactos del CRM filtra por organización + cliente y ordena por
 * `created_at`. En ambos casos los índices existentes cubren organización/cliente pero no la
 * columna de fecha, así que MySQL resuelve el ORDER BY con filesort en vez de leer el índice en
 * orden. Estos índices compuestos dejan que el motor resuelva filtro y orden en un solo recorrido.
 */
export class ReservationsContactsDateIndexes1724250000000 implements MigrationInterface {
  name = 'ReservationsContactsDateIndexes1724250000000';

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    table: string,
    indexName: string,
    definition: string,
  ): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, indexName],
    );
    if (Number(existing?.[0]?.total ?? 0) === 0) {
      await queryRunner.query(`CREATE INDEX ${indexName} ON ${table} (${definition})`);
    }
  }

  private async dropIndexIfExists(queryRunner: QueryRunner, table: string, indexName: string): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, indexName],
    );
    if (Number(existing?.[0]?.total ?? 0) > 0) {
      await queryRunner.query(`DROP INDEX ${indexName} ON ${table}`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createIndexIfMissing(
      queryRunner,
      'reservations',
      'IDX_reservations_org_client_starts',
      'organization_id, client_id, starts_at',
    );

    if (await queryRunner.hasTable('crm_contacts')) {
      await this.createIndexIfMissing(
        queryRunner,
        'crm_contacts',
        'IDX_crm_contacts_org_client_created',
        'organization_id, client_id, created_at',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(queryRunner, 'crm_contacts', 'IDX_crm_contacts_org_client_created');
    await this.dropIndexIfExists(queryRunner, 'reservations', 'IDX_reservations_org_client_starts');
  }
}
