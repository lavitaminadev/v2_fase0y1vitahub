import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddCoupons1710000000031 implements MigrationInterface {
  name = 'AddCoupons1710000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('reservation_coupons');
    if (!hasTable) {
      await queryRunner.createTable(new Table({
        name: 'reservation_coupons',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid', isNullable: true },
          { name: 'code', type: 'varchar', length: '80' },
          { name: 'discount_type', type: 'varchar', length: '20', default: "'percentage'" },
          { name: 'value', type: 'smallint', default: 0 },
          { name: 'max_uses', type: 'int', default: 0 },
          { name: 'usage_count', type: 'int', default: 0 },
          { name: 'valid_from', type: 'timestamp', isNullable: true },
          { name: 'valid_until', type: 'timestamp', isNullable: true },
          { name: 'form_ids', type: 'json', isNullable: true },
          { name: 'active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [{ columnNames: ['code', 'organization_id'], name: 'UQ_reservation_coupons_code_org' }],
      }));
    }
    if (!await queryRunner.hasColumn('reservations', 'coupon_code')) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'coupon_code', type: 'varchar', length: '80', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservations', 'coupon_code')) {
      await queryRunner.dropColumn('reservations', 'coupon_code');
    }
    if (await queryRunner.hasTable('reservation_coupons')) {
      await queryRunner.dropTable('reservation_coupons');
    }
  }
}
