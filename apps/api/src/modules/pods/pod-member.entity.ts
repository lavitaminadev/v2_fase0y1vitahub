import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pod_members')
@Index('UQ_pod_members_pair', ['podId', 'userId'], { unique: true })
export class PodMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'pod_id', type: 'uuid' }) podId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
