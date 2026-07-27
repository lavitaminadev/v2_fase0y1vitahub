import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'json', nullable: true }) data?: Record<string, any>;
  @Column({ type: 'boolean', default: false }) read: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
