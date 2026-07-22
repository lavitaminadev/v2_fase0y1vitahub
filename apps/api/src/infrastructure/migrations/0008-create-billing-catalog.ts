import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBillingCatalog1710000000008 implements MigrationInterface {
  name = 'CreateBillingCatalog1710000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'services',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category', type: 'varchar', length: '50' },
          { name: 'unit_price', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
          { name: 'ud_per_unit', type: 'decimal', precision: 8, scale: 2, default: 0 },
          { name: 'status', type: 'varchar', length: '50', default: "'active'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'quotes',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'number', type: 'varchar', length: '50', isUnique: true },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'amount', type: 'decimal', precision: 18, scale: 2 },
          { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
          { name: 'status', type: 'varchar', length: '50', default: "'draft'" },
          { name: 'valid_until', type: 'date', isNullable: true },
          { name: 'accepted_at', type: 'timestamp', isNullable: true },
          { name: 'created_by', type: 'uuid' },
          { name: 'items', type: 'json', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'quote_items',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'quote_id', type: 'uuid' },
          { name: 'service_id', type: 'uuid', isNullable: true },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'quantity', type: 'int', default: 1 },
          { name: 'unit_price', type: 'decimal', precision: 18, scale: 2 },
          { name: 'total', type: 'decimal', precision: 18, scale: 2 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'number', type: 'varchar', length: '50', isUnique: true },
          { name: 'issued_at', type: 'date' },
          { name: 'due_at', type: 'date' },
          { name: 'paid_at', type: 'timestamp', isNullable: true },
          { name: 'subtotal', type: 'decimal', precision: 18, scale: 2 },
          { name: 'tax', type: 'decimal', precision: 18, scale: 2, default: 0 },
          { name: 'total', type: 'decimal', precision: 18, scale: 2 },
          { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'invoice_id', type: 'uuid' },
          { name: 'amount', type: 'decimal', precision: 18, scale: 2 },
          { name: 'method', type: 'varchar', length: '50' },
          { name: 'reference', type: 'varchar', length: '255', isNullable: true },
          { name: 'paid_at', type: 'timestamp' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({ name: 'IDX_services_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'services',
      new TableIndex({ name: 'IDX_services_category', columnNames: ['category'] }),
    );
    await queryRunner.createIndex(
      'quotes',
      new TableIndex({ name: 'IDX_quotes_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'quotes',
      new TableIndex({ name: 'IDX_quotes_client_id', columnNames: ['client_id'] }),
    );
    await queryRunner.createIndex(
      'quote_items',
      new TableIndex({ name: 'IDX_quote_items_quote_id', columnNames: ['quote_id'] }),
    );
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({ name: 'IDX_invoices_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({ name: 'IDX_invoices_client_id', columnNames: ['client_id'] }),
    );
    await queryRunner.createIndex(
      'payments',
      new TableIndex({ name: 'IDX_payments_invoice_id', columnNames: ['invoice_id'] }),
    );

    await queryRunner.createForeignKey(
      'services',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'quotes',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'quotes',
      new TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'quote_items',
      new TableForeignKey({ columnNames: ['quote_id'], referencedColumnNames: ['id'], referencedTableName: 'quotes', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'invoices',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'invoices',
      new TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({ columnNames: ['invoice_id'], referencedColumnNames: ['id'], referencedTableName: 'invoices', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payments');
    await queryRunner.dropTable('invoices');
    await queryRunner.dropTable('quote_items');
    await queryRunner.dropTable('quotes');
    await queryRunner.dropTable('services');
  }
}
