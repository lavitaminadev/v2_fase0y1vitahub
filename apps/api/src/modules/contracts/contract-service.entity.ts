import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';

@Entity('contract_services')
export class ContractService {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'contract_id', type: 'uuid' }) contractId: string;
  @ManyToOne(() => Contract) @JoinColumn({ name: 'contract_id' }) contract: Contract;
  @Column({ name: 'service_id', type: 'uuid', nullable: true }) serviceId?: string;
  @Column({ name: 'pack_id', type: 'uuid', nullable: true }) packId?: string;
  @Column({ type: 'int', default: 1 }) quantity: number;
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 2, nullable: true }) unitPrice?: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
