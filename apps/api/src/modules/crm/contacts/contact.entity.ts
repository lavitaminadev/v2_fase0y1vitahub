import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';

@Entity('crm_contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @ManyToOne(() => Lead, { nullable: true }) @JoinColumn({ name: 'lead_id' }) lead?: Lead;
  /**
   * Cliente al que pertenece el contacto.
   *
   * Separa la audiencia de cada local: dos restaurantes con el mismo comensal tienen dos
   * contactos, y ninguno ve el del otro. Queda en null para los contactos comerciales, que
   * pertenecen a una empresa prospecto y no a un cliente.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email?: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) phone?: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) position?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
