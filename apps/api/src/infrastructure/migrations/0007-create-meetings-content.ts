import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMeetingsContent1710000000007 implements MigrationInterface {
  name = 'CreateMeetingsContent1710000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'meetings',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'status', type: 'varchar', length: '50', default: "'scheduled'" },
          { name: 'scheduled_at', type: 'timestamp' },
          { name: 'duration_minutes', type: 'int', default: 60 },
          { name: 'location', type: 'varchar', length: '255', isNullable: true },
          { name: 'meeting_link', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_by', type: 'uuid' },
          { name: 'minutes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'meeting_attendees',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'meeting_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'action_items',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'meeting_id', type: 'uuid' },
          { name: 'description', type: 'text' },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'due_at', type: 'timestamp', isNullable: true },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'meetings',
      new TableIndex({ name: 'IDX_meetings_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'meeting_attendees',
      new TableIndex({ name: 'IDX_meeting_attendees_meeting_id', columnNames: ['meeting_id'] }),
    );
    await queryRunner.createIndex(
      'meeting_attendees',
      new TableIndex({ name: 'IDX_meeting_attendees_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      'action_items',
      new TableIndex({ name: 'IDX_action_items_meeting_id', columnNames: ['meeting_id'] }),
    );

    await queryRunner.createForeignKey(
      'meetings',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'meeting_attendees',
      new TableForeignKey({ columnNames: ['meeting_id'], referencedColumnNames: ['id'], referencedTableName: 'meetings', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'meeting_attendees',
      new TableForeignKey({ columnNames: ['user_id'], referencedColumnNames: ['id'], referencedTableName: 'users', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'action_items',
      new TableForeignKey({ columnNames: ['meeting_id'], referencedColumnNames: ['id'], referencedTableName: 'meetings', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('action_items');
    await queryRunner.dropTable('meeting_attendees');
    await queryRunner.dropTable('meetings');
  }
}
