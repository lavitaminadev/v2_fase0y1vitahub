import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Acceso de una persona a una cuenta concreta, otorgado fuera de su pod.
 *
 * El acceso normal se hereda del pod: quien integra el pod ve las cuentas del pod. Esta
 * tabla guarda solo las excepciones —prestar una cuenta a alguien de otra área, cubrir una
 * ausencia— para que el caso corriente siga resolviéndose solo y no haya que mantener a
 * mano una fila por persona y cuenta.
 *
 * Queda registrado quién lo otorgó y cuándo, porque un acceso concedido a mano es
 * justamente el que hay que poder explicar en una revisión.
 */
@Entity('user_client_access')
@Index('UQ_user_client_access_pair', ['userId', 'clientId'], { unique: true })
@Index('IDX_user_client_access_user', ['organizationId', 'userId'])
export class UserClientAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  /** Motivo de la excepción, para que la revisión no dependa de la memoria de nadie. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
