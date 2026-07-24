import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `invoices.number` y `quotes.number` se crearon con una restricción UNIQUE
 * a nivel de columna (0008-create-billing-catalog.ts), que es global para
 * toda la base de datos en vez de estar acotada por organización. En una app
 * multi-tenant esto significa que dos organizaciones no relacionadas no
 * pueden usar ambas "INV-001", y permite que una organización infiera si
 * existe un número de factura específico en los datos de otra organización
 * mediante una colisión 409. La restricción correcta es
 * UNIQUE(organization_id, number).
 *
 * El nombre del índice unique anterior no está fijo en el código (fue
 * autogenerado por MySQL a partir de `isUnique: true`), así que esta
 * migración lo busca en information_schema en vez de asumir un nombre fijo.
 */
export class ScopeInvoiceQuoteNumberPerOrg1721765000000 implements MigrationInterface {
  name = 'ScopeInvoiceQuoteNumberPerOrg1721765000000';

  private async findUniqueIndexOnColumn(queryRunner: QueryRunner, table: string, column: string): Promise<string | undefined> {
    const rows: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY'`,
      [table, column],
    );
    return rows[0]?.INDEX_NAME;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invoiceIndex = await this.findUniqueIndexOnColumn(queryRunner, 'invoices', 'number');
    if (invoiceIndex) await queryRunner.query(`ALTER TABLE invoices DROP INDEX \`${invoiceIndex}\``);
    await queryRunner.query('ALTER TABLE invoices ADD UNIQUE INDEX UQ_invoices_org_number (organization_id, number)');

    const quoteIndex = await this.findUniqueIndexOnColumn(queryRunner, 'quotes', 'number');
    if (quoteIndex) await queryRunner.query(`ALTER TABLE quotes DROP INDEX \`${quoteIndex}\``);
    await queryRunner.query('ALTER TABLE quotes ADD UNIQUE INDEX UQ_quotes_org_number (organization_id, number)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE invoices DROP INDEX UQ_invoices_org_number');
    await queryRunner.query('ALTER TABLE invoices ADD UNIQUE INDEX number (number)');
    await queryRunner.query('ALTER TABLE quotes DROP INDEX UQ_quotes_org_number');
    await queryRunner.query('ALTER TABLE quotes ADD UNIQUE INDEX number (number)');
  }
}
