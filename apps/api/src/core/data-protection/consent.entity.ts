import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('data_consents')
export class DataConsent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 100 }) action: string;
  @Column({ type: 'boolean' }) granted: boolean;
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true }) ipAddress?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
