import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class CommercialPlanning1710000000025 implements MigrationInterface {
  name = 'CommercialPlanning1710000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('crm_opportunities', 'next_action')) {
      await queryRunner.addColumn('crm_opportunities', new TableColumn({ name: 'next_action', type: 'varchar', length: '500', isNullable: true }));
    }
    if (!await queryRunner.hasColumn('crm_opportunities', 'next_action_at')) {
      await queryRunner.addColumn('crm_opportunities', new TableColumn({ name: 'next_action_at', type: 'timestamp', isNullable: true }));
      await queryRunner.createIndex('crm_opportunities', new TableIndex({ name: 'IDX_crm_opportunities_next_action', columnNames: ['organization_id', 'next_action_at'] }));
    }
    if (!await queryRunner.hasColumn('pieces', 'dependency_ids')) {
      await queryRunner.addColumn('pieces', new TableColumn({ name: 'dependency_ids', type: 'json', isNullable: true }));
    }
    if (!await queryRunner.hasColumn('onboarding', 'blocked_reason')) await queryRunner.addColumn('onboarding', new TableColumn({ name: 'blocked_reason', type: 'varchar', length: '1000', isNullable: true }));
    if (!await queryRunner.hasColumn('onboarding', 'required_documents')) await queryRunner.addColumn('onboarding', new TableColumn({ name: 'required_documents', type: 'json', isNullable: true }));
    if (!await queryRunner.hasColumn('onboarding', 'received_documents')) await queryRunner.addColumn('onboarding', new TableColumn({ name: 'received_documents', type: 'json', isNullable: true }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('onboarding', 'received_documents')) await queryRunner.dropColumn('onboarding', 'received_documents');
    if (await queryRunner.hasColumn('onboarding', 'required_documents')) await queryRunner.dropColumn('onboarding', 'required_documents');
    if (await queryRunner.hasColumn('onboarding', 'blocked_reason')) await queryRunner.dropColumn('onboarding', 'blocked_reason');
    if (await queryRunner.hasColumn('pieces', 'dependency_ids')) await queryRunner.dropColumn('pieces', 'dependency_ids');
    const table = await queryRunner.getTable('crm_opportunities');
    if (table?.indices.some((index) => index.name === 'IDX_crm_opportunities_next_action')) await queryRunner.dropIndex('crm_opportunities', 'IDX_crm_opportunities_next_action');
    if (await queryRunner.hasColumn('crm_opportunities', 'next_action_at')) await queryRunner.dropColumn('crm_opportunities', 'next_action_at');
    if (await queryRunner.hasColumn('crm_opportunities', 'next_action')) await queryRunner.dropColumn('crm_opportunities', 'next_action');
  }
}
