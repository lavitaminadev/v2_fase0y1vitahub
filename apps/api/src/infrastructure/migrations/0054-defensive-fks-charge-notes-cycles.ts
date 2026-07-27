import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

/**
 * `account_cycles` y `charge_notes` (migración 0013) se crearon sin ninguna
 * foreign key — ver docs/decisions/pending-business-decisions.md #14.
 *
 * Agregar las constraints a ciegas podría romper el deploy si en producción
 * ya existen filas huérfanas (apuntando a un registro que ya no existe).
 * Esta migración es defensiva: para cada foreign key candidata, primero
 * cuenta huérfanos con un LEFT JOIN; si no hay ninguno, agrega la constraint;
 * si encuentra huérfanos, los deja tal cual y los reporta por consola para
 * que alguien los revise manualmente — nunca hace fallar el deploy completo
 * por datos sucios en una sola tabla.
 */
export class DefensiveFksChargeNotesCycles1721766500000 implements MigrationInterface {
  name = 'DefensiveFksChargeNotesCycles1721766500000';

  private readonly candidates: Array<{
    table: string;
    column: string;
    referencedTable: string;
    onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL';
    nullable: boolean;
  }> = [
    { table: 'account_cycles', column: 'organization_id', referencedTable: 'organizations', onDelete: 'CASCADE', nullable: false },
    { table: 'account_cycles', column: 'client_id', referencedTable: 'clients', onDelete: 'CASCADE', nullable: false },
    { table: 'charge_notes', column: 'organization_id', referencedTable: 'organizations', onDelete: 'CASCADE', nullable: false },
    // Nota de cobro es dato financiero, igual criterio que invoices/monthly_reports (migración 0053):
    // no permitir que borrar un cliente arrastre en cascada sus cargos pendientes.
    { table: 'charge_notes', column: 'client_id', referencedTable: 'clients', onDelete: 'RESTRICT', nullable: false },
    { table: 'charge_notes', column: 'piece_id', referencedTable: 'pieces', onDelete: 'CASCADE', nullable: false },
    { table: 'charge_notes', column: 'correction_id', referencedTable: 'corrections', onDelete: 'CASCADE', nullable: false },
    { table: 'charge_notes', column: 'invoice_id', referencedTable: 'invoices', onDelete: 'SET NULL', nullable: true },
    { table: 'charge_notes', column: 'created_by', referencedTable: 'users', onDelete: 'SET NULL', nullable: true },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const candidate of this.candidates) {
      const nullClause = candidate.nullable ? `AND t.${candidate.column} IS NOT NULL` : '';
      const orphanRows: Array<{ orphans: number }> = await queryRunner.query(
        `SELECT COUNT(*) as orphans FROM ${candidate.table} t
         LEFT JOIN ${candidate.referencedTable} r ON t.${candidate.column} = r.id
         WHERE r.id IS NULL ${nullClause}`,
      );
      const orphanCount = Number(orphanRows[0]?.orphans ?? 0);
      if (orphanCount > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[migration 0054] Saltando FK ${candidate.table}.${candidate.column} -> ${candidate.referencedTable}: ` +
          `${orphanCount} fila(s) huerfana(s) encontradas. Revisar y limpiar antes de agregar la constraint manualmente.`,
        );
        continue;
      }
      await queryRunner.createForeignKey(candidate.table, new TableForeignKey({
        columnNames: [candidate.column],
        referencedTableName: candidate.referencedTable,
        referencedColumnNames: ['id'],
        onDelete: candidate.onDelete,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const candidate of this.candidates) {
      const tableSchema = await queryRunner.getTable(candidate.table);
      const foreignKey = tableSchema?.foreignKeys.find((key) => key.columnNames.includes(candidate.column) && key.referencedTableName === candidate.referencedTable);
      if (foreignKey) await queryRunner.dropForeignKey(candidate.table, foreignKey);
    }
  }
}
