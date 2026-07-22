import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CommercialMonthlyReports1710000000022 implements MigrationInterface {
  name = 'CommercialMonthlyReports1710000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const quotes = await queryRunner.getTable('quotes');
    const clientColumn = quotes?.findColumnByName('client_id');
    if (clientColumn && !clientColumn.isNullable) {
      const foreignKey = quotes?.foreignKeys.find((key) => key.columnNames.includes('client_id'));
      if (foreignKey) await queryRunner.dropForeignKey('quotes', foreignKey);
      await queryRunner.changeColumn('quotes', 'client_id', new TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
      await queryRunner.createForeignKey('quotes', new TableForeignKey({ columnNames: ['client_id'], referencedTableName: 'clients', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));
    }
    await this.ensureColumn(queryRunner, 'quotes', new TableColumn({ name: 'lead_id', type: 'uuid', isNullable: true }));
    await this.ensureColumn(queryRunner, 'quotes', new TableColumn({ name: 'version', type: 'int', default: 1 }));
    await this.ensureColumn(queryRunner, 'quotes', new TableColumn({ name: 'parent_quote_id', type: 'uuid', isNullable: true }));
    await this.ensureColumn(queryRunner, 'quotes', new TableColumn({ name: 'sent_at', type: 'timestamp', isNullable: true }));

    for (const column of [
      new TableColumn({ name: 'pack_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, default: 0 }),
      new TableColumn({ name: 'committed_ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }),
      new TableColumn({ name: 'included_reels', type: 'int', default: 0 }),
      new TableColumn({ name: 'billing_cycle', type: 'varchar', length: '30', default: "'monthly_advance'" }),
    ]) await this.ensureColumn(queryRunner, 'contracts', column);

    if (!await queryRunner.hasTable('monthly_reports')) {
      await queryRunner.createTable(new Table({
        name: 'monthly_reports',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'year', type: 'smallint' },
          { name: 'month', type: 'tinyint' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
          { name: 'executive_summary', type: 'text', isNullable: true },
          { name: 'metrics', type: 'json' },
          { name: 'insights', type: 'json', isNullable: true },
          { name: 'recommendations', type: 'text', isNullable: true },
          { name: 'sales_generated', type: 'decimal', precision: 18, scale: 2, default: 0 },
          { name: 'ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 },
          { name: 'leads', type: 'int', default: 0 },
          { name: 'bookings', type: 'int', default: 0 },
          { name: 'conversions', type: 'int', default: 0 },
          { name: 'created_by', type: 'uuid' },
          { name: 'published_by', type: 'uuid', isNullable: true },
          { name: 'published_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          new TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['client_id'], referencedTableName: 'clients', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        ],
        indices: [
          new TableIndex({ name: 'UQ_monthly_reports_client_period', columnNames: ['client_id', 'year', 'month'], isUnique: true }),
          new TableIndex({ name: 'IDX_monthly_reports_org_status', columnNames: ['organization_id', 'status'] }),
        ],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('monthly_reports')) await queryRunner.dropTable('monthly_reports');
    for (const column of ['billing_cycle', 'included_reels', 'committed_ad_spend', 'monthly_price', 'pack_id']) if (await queryRunner.hasColumn('contracts', column)) await queryRunner.dropColumn('contracts', column);
    for (const column of ['sent_at', 'parent_quote_id', 'version', 'lead_id']) if (await queryRunner.hasColumn('quotes', column)) await queryRunner.dropColumn('quotes', column);
  }

  private async ensureColumn(queryRunner: QueryRunner, table: string, column: TableColumn): Promise<void> {
    if (!await queryRunner.hasColumn(table, column.name)) await queryRunner.addColumn(table, column);
  }
}
