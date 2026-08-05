import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Motivo de pérdida de una oportunidad comercial. Antes de esto, arrastrar una tarjeta a
 * "Perdido" en el Kanban (`CrmRecordsPage.tsx`) no dejaba ningún registro de por qué —
 * imposible reportar por motivo de pérdida más adelante.
 */
export class OpportunityLossReason1725600000000 implements MigrationInterface {
  name = 'OpportunityLossReason1725600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('crm_opportunities', 'loss_reason'))) {
      await queryRunner.addColumn('crm_opportunities', new TableColumn({
        name: 'loss_reason', type: 'varchar', length: '60', isNullable: true,
      }));
    }
    if (!(await queryRunner.hasColumn('crm_opportunities', 'loss_note'))) {
      await queryRunner.addColumn('crm_opportunities', new TableColumn({
        name: 'loss_note', type: 'text', isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('crm_opportunities', 'loss_note')) await queryRunner.dropColumn('crm_opportunities', 'loss_note');
    if (await queryRunner.hasColumn('crm_opportunities', 'loss_reason')) await queryRunner.dropColumn('crm_opportunities', 'loss_reason');
  }
}
