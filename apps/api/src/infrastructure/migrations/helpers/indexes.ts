import { QueryRunner } from 'typeorm';

/**
 * Utilidades para migraciones que agregan índices, con dos garantías:
 *
 * - **Reejecutables.** En MySQL el DDL no participa de la transacción de la migración, por
 *   lo que una migración interrumpida deja índices ya creados. Verificar su existencia
 *   permite reintentarla sin conflictos de clave duplicada.
 * - **Tolerantes al esquema.** Un índice afecta al rendimiento, no a la correctitud: si la
 *   tabla o la columna no existe en un ambiente, se omite y el despliegue continúa.
 *
 * El directorio queda fuera del glob de migraciones (`migrations/*`), por lo que TypeORM
 * no lo carga como migración.
 */
export type IndexSpec = {
  table: string;
  name: string;
  columns: string[];
  /** SQL de la definicion cuando no es la simple lista de columnas, por ejemplo `DESC`. */
  definition?: string;
};

async function indexExists(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT COUNT(*) AS total FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, name],
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function columnsExist(queryRunner: QueryRunner, table: string, columns: string[]): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN (${columns.map(() => '?').join(', ')})`,
    [table, ...columns],
  );
  return Number(rows?.[0]?.total ?? 0) === columns.length;
}

/** Crea cada indice que falte, omitiendo los que ya existen o cuya tabla/columna no esta. */
export async function ensureIndexes(queryRunner: QueryRunner, specs: IndexSpec[]): Promise<void> {
  for (const spec of specs) {
    if (!(await queryRunner.hasTable(spec.table))) continue;
    if (!(await columnsExist(queryRunner, spec.table, spec.columns))) continue;
    if (await indexExists(queryRunner, spec.table, spec.name)) continue;
    const definition = spec.definition ?? `(${spec.columns.join(', ')})`;
    await queryRunner.query(`ALTER TABLE \`${spec.table}\` ADD INDEX \`${spec.name}\` ${definition}`);
  }
}

/** Elimina en orden inverso los indices que existan. */
export async function dropIndexes(queryRunner: QueryRunner, specs: IndexSpec[]): Promise<void> {
  for (const spec of [...specs].reverse()) {
    if (!(await queryRunner.hasTable(spec.table))) continue;
    if (!(await indexExists(queryRunner, spec.table, spec.name))) continue;
    await queryRunner.query(`ALTER TABLE \`${spec.table}\` DROP INDEX \`${spec.name}\``);
  }
}
