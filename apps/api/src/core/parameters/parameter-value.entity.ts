import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ParameterDefinition } from './parameter-definition.entity';

@Entity('parameter_values')
export class ParameterValue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'definition_id', type: 'uuid' }) definitionId: string;
  @ManyToOne(() => ParameterDefinition, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'definition_id' }) definition: ParameterDefinition;
  @Column({ name: 'scope_type', type: 'varchar', length: 50 }) scopeType: string;
  @Column({ name: 'scope_id', type: 'uuid' }) scopeId: string;
  @Column({ name: 'value_json', type: 'json' }) valueJson: { value: any };
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ name: 'valid_from', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) validFrom: Date;
  @Column({ name: 'valid_to', type: 'datetime', nullable: true }) validTo?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
