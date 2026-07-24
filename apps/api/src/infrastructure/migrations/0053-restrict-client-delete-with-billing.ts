import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

/**
 * `DELETE /clients/:id` hace un borrado físico (`repo.remove()`), y hasta
 * ahora `invoices.client_id` y `monthly_reports.client_id` tenían
 * `onDelete: CASCADE` — es decir, borrar un cliente borraba en cascada
 * (silenciosamente, sin aviso) todas sus facturas, pagos e informes
 * mensuales. Eso es pérdida irreversible de historial financiero.
 *
 * Este cambio no decide la política definitiva (soft-delete vs. hard-delete
 * — ver docs/decisions/pending-business-decisions.md #13), solo agrega un
 * freno de seguridad: con RESTRICT, MySQL rechaza el DELETE del cliente si
 * todavía tiene facturas o informes asociados, obligando a resolver eso
 * primero (archivar las facturas, reasignarlas, etc.) en vez de perderlas
 * por accidente.
 */
export class RestrictClientDeleteWithBilling1721766000000 implements MigrationInterface {
  name = 'RestrictClientDeleteWithBilling1721766000000';

  private async replaceClientFk(queryRunner: QueryRunner, table: string, onDelete: 'RESTRICT' | 'CASCADE'): Promise<void> {
    const tableSchema = await queryRunner.getTable(table);
    const foreignKey = tableSchema?.foreignKeys.find((key) => key.columnNames.includes('client_id') && key.referencedTableName === 'clients');
    if (foreignKey) await queryRunner.dropForeignKey(table, foreignKey);
    await queryRunner.createForeignKey(table, new TableForeignKey({
      columnNames: ['client_id'],
      referencedTableName: 'clients',
      referencedColumnNames: ['id'],
      onDelete,
    }));
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceClientFk(queryRunner, 'invoices', 'RESTRICT');
    await this.replaceClientFk(queryRunner, 'monthly_reports', 'RESTRICT');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.replaceClientFk(queryRunner, 'invoices', 'CASCADE');
    await this.replaceClientFk(queryRunner, 'monthly_reports', 'CASCADE');
  }
}
