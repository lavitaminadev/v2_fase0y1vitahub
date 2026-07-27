import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PermissionLevel } from './permission-level';

/**
 * Excepción de permiso para una persona concreta sobre un módulo.
 *
 * El rol define el acceso normal de cada cargo; esta tabla guarda únicamente las
 * desviaciones. Un módulo sin fila aquí se resuelve por el rol, de modo que la ausencia de
 * registros equivale a la configuración estándar.
 *
 * `level: 'none'` es una denegación explícita y prevalece sobre lo que otorgue el rol.
 */
@Entity('user_permission_overrides')
@Index('UQ_user_permission_override', ['userId', 'module'], { unique: true })
export class UserPermissionOverride {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  /** Clave del módulo, coincidente con `ORGANIZATION_FEATURE_KEYS`. */
  @Column({ type: 'varchar', length: 60 }) module: string;

  @Column({ type: 'varchar', length: 20 }) level: PermissionLevel;

  /** Motivo de la excepción, para que sea auditable meses después. */
  @Column({ type: 'varchar', length: 300, nullable: true }) reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true }) grantedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
