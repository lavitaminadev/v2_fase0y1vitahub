import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { UserRole } from '../organizations/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 50, default: UserRole.DESIGNER })
  role: UserRole;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId?: string;

  @Column({ name: 'work_mode', type: 'varchar', length: 20, nullable: true })
  workMode?: 'presential' | 'hybrid' | 'remote';

  @Column({ name: 'weekly_capacity_ud', type: 'decimal', precision: 8, scale: 2, default: 20 })
  weeklyCapacityUd: number;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ name: 'invited_at', type: 'timestamp', nullable: true })
  invitedAt?: Date;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ name: 'refresh_token', type: 'text', nullable: true, select: false })
  refreshToken?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    this.name = this.name?.trim();
    this.email = this.email?.trim().toLowerCase();
    this.phone = this.phone?.replace(/[^\d+]/g, '') || null;
  }
}
