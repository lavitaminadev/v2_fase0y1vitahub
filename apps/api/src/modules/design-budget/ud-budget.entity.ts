import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from '../clients/client.entity';

@Entity('ud_budgets')
export class UDBudget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ type: 'smallint' }) year: number;
  @Column({ type: 'tinyint' }) month: number;
  @Column({ type: 'decimal', precision: 8, scale: 2 }) contracted: number;
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 }) reserved: number;
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 }) consumed: number;
  @Column({ type: 'varchar', length: 20, default: 'open' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
