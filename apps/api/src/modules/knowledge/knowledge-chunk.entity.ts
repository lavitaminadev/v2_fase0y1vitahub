import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';

/**
 * Un fragmento (chunk) de un documento subido a la base de conocimiento,
 * junto con su embedding vectorial. Reemplaza el `Map` en memoria que
 * usaba `KnowledgeStore` antes de esta entidad — ver knowledge.store.ts.
 */
@Entity('knowledge_chunks')
export class KnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Organization;

  @Column({ type: 'text' })
  content: string;

  /** Vector de embedding, guardado como JSON (ver nota en la migracion 0055). */
  @Column({ type: 'json' })
  embedding: number[];

  @Column({ name: 'source_name', type: 'varchar', length: 255 })
  sourceName: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ name: 'token_count', type: 'int' })
  tokenCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
