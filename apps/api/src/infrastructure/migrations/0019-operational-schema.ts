import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import type { TableColumnOptions } from 'typeorm';

export class OperationalSchema1710000000019 implements MigrationInterface {
  name = 'OperationalSchema1710000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureUserClientScope(queryRunner);
    await this.ensureNotifications(queryRunner);
    await this.ensureExistingOperationalColumns(queryRunner);

    await this.createIfMissing(queryRunner, new Table({
      name: 'documents',
      columns: [
        this.id(), this.orgId(),
        { name: 'client_id', type: 'uuid', isNullable: true },
        { name: 'name', type: 'varchar', length: '255' },
        { name: 'type', type: 'varchar', length: '50', default: "'other'" },
        { name: 'file_url', type: 'varchar', length: '500', isNullable: true },
        { name: 'drive_file_id', type: 'varchar', length: '255', isNullable: true },
        { name: 'version', type: 'int', default: 1 },
        { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
        { name: 'uploaded_by', type: 'uuid' },
        { name: 'tags', type: 'json', isNullable: true },
        ...this.timestamps(),
      ],
      indices: [{ name: 'IDX_documents_org_client', columnNames: ['organization_id', 'client_id'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('client_id', 'clients', 'id', 'SET NULL'),
        this.foreignKey('uploaded_by', 'users', 'id', 'CASCADE'),
      ],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'uploads',
      columns: [
        this.id(), this.orgId(),
        { name: 'file_name', type: 'varchar', length: '255' },
        { name: 'original_name', type: 'varchar', length: '255' },
        { name: 'mime_type', type: 'varchar', length: '100' },
        { name: 'size', type: 'int' },
        { name: 'path', type: 'varchar', length: '500' },
        { name: 'drive_file_id', type: 'varchar', length: '255', isNullable: true },
        { name: 'uploaded_by', type: 'uuid' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_uploads_organization', columnNames: ['organization_id'] }],
      foreignKeys: [this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE')],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'data_consents',
      columns: [
        this.id(),
        { name: 'user_id', type: 'uuid' },
        { name: 'action', type: 'varchar', length: '100' },
        { name: 'granted', type: 'boolean' },
        { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_data_consents_user_action', columnNames: ['user_id', 'action'] }],
      foreignKeys: [this.foreignKey('user_id', 'users', 'id', 'CASCADE')],
    }));

    await this.createCrmTables(queryRunner);
    await this.createCatalogAndContractTables(queryRunner);
    await this.createAudiovisualTables(queryRunner);
  }

  async down(): Promise<void> {
    throw new Error('OperationalSchema1710000000019 is forward-only; restore a database backup to roll it back safely.');
  }

  private async ensureUserClientScope(queryRunner: QueryRunner): Promise<void> {
    let users = await queryRunner.getTable('users');
    if (!users?.findColumnByName('client_id')) {
      await queryRunner.addColumn('users', new TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
      users = await queryRunner.getTable('users');
    }
    if (!users?.indices.some((index) => index.name === 'IDX_users_client_id')) {
      await queryRunner.createIndex('users', new TableIndex({ name: 'IDX_users_client_id', columnNames: ['client_id'] }));
    }
    const refreshed = await queryRunner.getTable('users');
    if (!refreshed?.foreignKeys.some((key) => key.columnNames.includes('client_id'))) {
      await queryRunner.createForeignKey('users', this.foreignKey('client_id', 'clients', 'id', 'SET NULL'));
    }
  }

  private async ensureNotifications(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('notifications'))) {
      await queryRunner.createTable(new Table({
        name: 'notifications',
        columns: [
          this.id(), this.orgId(),
          { name: 'user_id', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'message', type: 'text' },
          { name: 'data', type: 'json', isNullable: true },
          { name: 'read', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'IDX_notifications_user_read', columnNames: ['user_id', 'read', 'created_at'] },
          { name: 'IDX_notifications_org_user', columnNames: ['organization_id', 'user_id'] },
        ],
        foreignKeys: [
          this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
          this.foreignKey('user_id', 'users', 'id', 'CASCADE'),
        ],
      }), true);
      return;
    }

    let table = await queryRunner.getTable('notifications');
    if (!table?.findColumnByName('organization_id')) {
      await queryRunner.addColumn('notifications', new TableColumn({ name: 'organization_id', type: 'uuid', isNullable: true }));
      await queryRunner.query(`UPDATE notifications n INNER JOIN users u ON u.id = n.user_id SET n.organization_id = u.organization_id WHERE n.organization_id IS NULL`);
      await queryRunner.changeColumn('notifications', 'organization_id', new TableColumn({ name: 'organization_id', type: 'uuid' }));
      table = await queryRunner.getTable('notifications');
    }
    if (!table?.indices.some((index) => index.name === 'IDX_notifications_user_read')) {
      await queryRunner.createIndex('notifications', new TableIndex({ name: 'IDX_notifications_user_read', columnNames: ['user_id', 'read', 'created_at'] }));
    }
    if (!table?.indices.some((index) => index.name === 'IDX_notifications_org_user')) {
      await queryRunner.createIndex('notifications', new TableIndex({ name: 'IDX_notifications_org_user', columnNames: ['organization_id', 'user_id'] }));
    }
  }

  private async ensureExistingOperationalColumns(queryRunner: QueryRunner): Promise<void> {
    await this.ensureColumn(queryRunner, 'corrections', new TableColumn({ name: 'billable_extra', type: 'boolean', default: false }));
    await this.ensureColumn(queryRunner, 'corrections', new TableColumn({ name: 'charge_note_required', type: 'boolean', default: false }));

    await this.ensureColumn(queryRunner, 'approval_requests', new TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
    await this.ensureIndex(queryRunner, 'approval_requests', 'IDX_approval_requests_client_id', ['client_id']);
    await this.ensureForeignKey(queryRunner, 'approval_requests', 'client_id', 'clients', 'id', 'SET NULL');

    await this.ensureColumn(queryRunner, 'meetings', new TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
    await this.ensureIndex(queryRunner, 'meetings', 'IDX_meetings_client_id', ['client_id']);
    await this.ensureForeignKey(queryRunner, 'meetings', 'client_id', 'clients', 'id', 'SET NULL');
  }

  private async createCrmTables(queryRunner: QueryRunner): Promise<void> {
    await this.createIfMissing(queryRunner, new Table({
      name: 'crm_contacts',
      columns: [
        this.id(), this.orgId(),
        { name: 'lead_id', type: 'uuid', isNullable: true },
        { name: 'name', type: 'varchar', length: '255' },
        { name: 'email', type: 'varchar', length: '255', isNullable: true },
        { name: 'phone', type: 'varchar', length: '50', isNullable: true },
        { name: 'position', type: 'varchar', length: '255', isNullable: true },
        { name: 'notes', type: 'text', isNullable: true },
        ...this.timestamps(),
      ],
      indices: [{ name: 'IDX_crm_contacts_organization', columnNames: ['organization_id'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('lead_id', 'leads', 'id', 'SET NULL'),
      ],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'crm_interactions',
      columns: [
        this.id(), this.orgId(),
        { name: 'lead_id', type: 'uuid', isNullable: true },
        { name: 'contact_id', type: 'uuid', isNullable: true },
        { name: 'type', type: 'varchar', length: '50' },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'date', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'created_by', type: 'uuid', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_crm_interactions_org_date', columnNames: ['organization_id', 'date'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('lead_id', 'leads', 'id', 'SET NULL'),
        this.foreignKey('contact_id', 'crm_contacts', 'id', 'SET NULL'),
      ],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'crm_opportunities',
      columns: [
        this.id(), this.orgId(),
        { name: 'lead_id', type: 'uuid', isNullable: true },
        { name: 'client_id', type: 'uuid', isNullable: true },
        { name: 'name', type: 'varchar', length: '255' },
        { name: 'amount', type: 'decimal', precision: 18, scale: 2, isNullable: true },
        { name: 'stage', type: 'varchar', length: '50', default: "'new'" },
        { name: 'probability', type: 'int', default: 0 },
        { name: 'expected_close_date', type: 'date', isNullable: true },
        { name: 'assigned_to', type: 'uuid', isNullable: true },
        ...this.timestamps(),
      ],
      indices: [{ name: 'IDX_crm_opportunities_org_stage', columnNames: ['organization_id', 'stage'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('lead_id', 'leads', 'id', 'SET NULL'),
        this.foreignKey('client_id', 'clients', 'id', 'SET NULL'),
      ],
    }));
  }

  private async createCatalogAndContractTables(queryRunner: QueryRunner): Promise<void> {
    await this.createIfMissing(queryRunner, new Table({
      name: 'catalog_packs',
      columns: [
        this.id(), this.orgId(),
        { name: 'name', type: 'varchar', length: '255' },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 },
        { name: 'reels_included', type: 'int', default: 0 },
        { name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, isNullable: true },
        { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
        { name: 'services', type: 'text', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'active'" },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_catalog_packs_organization', columnNames: ['organization_id'] }],
      foreignKeys: [this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE')],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'contract_services',
      columns: [
        this.id(),
        { name: 'contract_id', type: 'uuid' },
        { name: 'service_id', type: 'uuid', isNullable: true },
        { name: 'pack_id', type: 'uuid', isNullable: true },
        { name: 'quantity', type: 'int', default: 1 },
        { name: 'unit_price', type: 'decimal', precision: 18, scale: 2, isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_contract_services_contract', columnNames: ['contract_id'] }],
      foreignKeys: [
        this.foreignKey('contract_id', 'contracts', 'id', 'CASCADE'),
        this.foreignKey('service_id', 'services', 'id', 'SET NULL'),
        this.foreignKey('pack_id', 'catalog_packs', 'id', 'SET NULL'),
      ],
    }));
  }

  private async createAudiovisualTables(queryRunner: QueryRunner): Promise<void> {
    await this.createIfMissing(queryRunner, new Table({
      name: 'moodboards',
      columns: [
        this.id(), this.orgId(), { name: 'client_id', type: 'uuid' },
        { name: 'title', type: 'varchar', length: '255' },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'images', type: 'json', isNullable: true },
        { name: 'created_by', type: 'uuid', isNullable: true },
        { name: 'verified_by', type: 'uuid', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
        ...this.timestamps(),
      ],
      indices: [{ name: 'IDX_moodboards_org_client', columnNames: ['organization_id', 'client_id'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('client_id', 'clients', 'id', 'CASCADE'),
      ],
    }));

    await this.createIfMissing(queryRunner, new Table({
      name: 'av_sessions',
      columns: [
        this.id(), this.orgId(), { name: 'client_id', type: 'uuid' },
        { name: 'type', type: 'varchar', length: '50' },
        { name: 'date', type: 'date' },
        { name: 'location', type: 'varchar', length: '255', isNullable: true },
        { name: 'assigned_team', type: 'json', isNullable: true },
        { name: 'moodboard_id', type: 'uuid', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'scheduled'" },
        ...this.timestamps(),
      ],
      indices: [{ name: 'IDX_av_sessions_org_date', columnNames: ['organization_id', 'date'] }],
      foreignKeys: [
        this.foreignKey('organization_id', 'organizations', 'id', 'CASCADE'),
        this.foreignKey('client_id', 'clients', 'id', 'CASCADE'),
        this.foreignKey('moodboard_id', 'moodboards', 'id', 'SET NULL'),
      ],
    }));
  }

  private async createIfMissing(queryRunner: QueryRunner, table: Table): Promise<void> {
    if (!(await queryRunner.hasTable(table.name))) await queryRunner.createTable(table, true);
  }

  private async ensureColumn(queryRunner: QueryRunner, tableName: string, column: TableColumn): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (table && !table.findColumnByName(column.name)) await queryRunner.addColumn(tableName, column);
  }

  private async ensureIndex(queryRunner: QueryRunner, tableName: string, name: string, columnNames: string[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (table && !table.indices.some((index) => index.name === name)) {
      await queryRunner.createIndex(tableName, new TableIndex({ name, columnNames }));
    }
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    column: string,
    referencedTable: string,
    referencedColumn: string,
    onDelete: 'CASCADE' | 'SET NULL',
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (table && !table.foreignKeys.some((key) => key.columnNames.includes(column))) {
      await queryRunner.createForeignKey(tableName, this.foreignKey(column, referencedTable, referencedColumn, onDelete));
    }
  }

  private id(): TableColumnOptions {
    return { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' };
  }

  private orgId(): TableColumnOptions {
    return { name: 'organization_id', type: 'uuid' };
  }

  private timestamps(): TableColumnOptions[] {
    return [
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
    ];
  }

  private foreignKey(column: string, table: string, referencedColumn: string, onDelete: 'CASCADE' | 'SET NULL'): TableForeignKey {
    return new TableForeignKey({ columnNames: [column], referencedTableName: table, referencedColumnNames: [referencedColumn], onDelete });
  }
}
