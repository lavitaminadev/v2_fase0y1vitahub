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

  /**
   * Intentos de acceso fallidos consecutivos. Se reinicia al entrar correctamente.
   *
   * El límite por IP frena una ráfaga desde un origen, pero no un ataque repartido entre
   * muchas direcciones contra una misma cuenta. Este contador vive en la cuenta, así que
   * cuenta los intentos vengan de donde vengan.
   */
  @Column({ name: 'failed_login_attempts', type: 'smallint', default: 0 })
  failedLoginAttempts: number;

  /** Momento hasta el cual la cuenta rechaza intentos, o `null` si está abierta. */
  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil?: Date | null;

  /** Último acceso correcto, para que el titular pueda reconocer actividad ajena. */
  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  /** Aceptación de términos del primer ingreso: versión y momento. */
  @Column({ name: 'terms_accepted_at', type: 'timestamp', nullable: true })
  termsAcceptedAt?: Date | null;

  @Column({ name: 'terms_version', type: 'varchar', length: 20, nullable: true })
  termsVersion?: string | null;

  /** Queda en `true` hasta que la persona completa sus propios datos de perfil. */
  @Column({ name: 'must_complete_profile', type: 'boolean', default: false })
  mustCompleteProfile: boolean;

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
