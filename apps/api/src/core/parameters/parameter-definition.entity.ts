import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('parameter_definitions')
export class ParameterDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100, unique: true }) key: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ name: 'default_value', type: 'json', nullable: true }) defaultValue?: { value: any };
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
