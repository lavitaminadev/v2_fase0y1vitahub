import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_tokens')
@Index('IDX_password_reset_user', ['userId', 'usedAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true }) tokenHash: string;
  @Column({ name: 'expires_at', type: 'timestamp' }) expiresAt: Date;
  @Column({ name: 'used_at', type: 'timestamp', nullable: true }) usedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
