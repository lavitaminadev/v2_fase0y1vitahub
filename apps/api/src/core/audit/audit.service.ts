import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { User } from '../../modules/users/user.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
  ) {}

  async log(params: {
    organizationId: string;
    actorId?: string;
    entityType: string;
    entityId?: string | null;
    action: string;
    before?: any;
    after?: any;
    reason?: string;
    ipAddress?: string;
  }) {
    const entry = this.repo.create(params);
    return this.repo.save(entry);
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.repo.find({
      where: { entityType, entityId },
      order: { occurredAt: 'DESC' },
      take: 50,
    });
  }

  async search(organizationId: string, options: { entityType?: string; action?: string; actorId?: string; limit?: number }) {
    const query = this.repo.createQueryBuilder('audit')
      .leftJoin(User, 'actor', 'actor.id = audit.actor_id')
      .select('audit.id', 'id')
      .addSelect('audit.entity_type', 'entityType')
      .addSelect('audit.entity_id', 'entityId')
      .addSelect('audit.action', 'action')
      .addSelect('audit.after', 'after')
      .addSelect('audit.reason', 'reason')
      .addSelect('audit.ip_address', 'ipAddress')
      .addSelect('audit.occurred_at', 'occurredAt')
      .addSelect('audit.actor_id', 'actorId')
      .addSelect('actor.name', 'actorName')
      .addSelect('actor.email', 'actorEmail')
      .where('audit.organization_id = :organizationId', { organizationId })
      .orderBy('audit.occurred_at', 'DESC')
      .limit(Math.min(Math.max(options.limit ?? 100, 1), 500));
    if (options.entityType) query.andWhere('audit.entity_type = :entityType', { entityType: options.entityType });
    if (options.action) query.andWhere('audit.action = :action', { action: options.action });
    if (options.actorId) query.andWhere('audit.actor_id = :actorId', { actorId: options.actorId });
    return query.getRawMany();
  }

  async findByOrganization(organizationId: string, limit = 100) {
    return this.repo.find({
      where: { organizationId },
      order: { occurredAt: 'DESC' },
      take: limit,
    });
  }
}
