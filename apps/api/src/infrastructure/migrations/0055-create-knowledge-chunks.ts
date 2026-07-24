import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * `KnowledgeStore` vivia 100% en un `Map` en memoria (ver
 * docs/decisions/pending-business-decisions.md #16): toda la base de
 * conocimiento (documentos subidos + sus embeddings) se perdia en cada
 * deploy o reinicio de Passenger. Esta migracion crea la tabla real.
 *
 * `embedding` se guarda como JSON (array de floats) en vez de un tipo
 * vectorial nativo: no se puede asumir que la version de MySQL en el
 * hosting soporte VECTOR (MySQL 9+), y el volumen de chunks por tenant es
 * chico (documentos internos, no un dataset masivo), asi que un escaneo de
 * similitud coseno en memoria — igual que hoy — sigue siendo razonable.
 */
export class CreateKnowledgeChunks1721767000000 implements MigrationInterface {
  name = 'CreateKnowledgeChunks1721767000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'knowledge_chunks',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
        { name: 'tenant_id', type: 'uuid' },
        { name: 'content', type: 'text' },
        { name: 'embedding', type: 'json' },
        { name: 'source_name', type: 'varchar', length: '255' },
        { name: 'chunk_index', type: 'int' },
        { name: 'token_count', type: 'int' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('knowledge_chunks', new TableIndex({
      name: 'IDX_knowledge_chunks_tenant', columnNames: ['tenant_id'],
    }));
    await queryRunner.createIndex('knowledge_chunks', new TableIndex({
      name: 'IDX_knowledge_chunks_tenant_source', columnNames: ['tenant_id', 'source_name'],
    }));

    // tenant_id references organizations.id — "tenant" and "organization" are the
    // same id in this app, this module just predates the organizationId naming.
    await queryRunner.createForeignKey('knowledge_chunks', new TableForeignKey({
      columnNames: ['tenant_id'],
      referencedTableName: 'organizations',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('knowledge_chunks');
  }
}
