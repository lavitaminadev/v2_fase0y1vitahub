import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Lead } from '../lead.entity';

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
  ) {}

  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
    status?: string,
    fitStatus?: string,
    source?: string,
    clientId?: string,
  ): Promise<{ data: Lead[]; total: number; limit: number; offset: number }> {
    const where: FindOptionsWhere<Lead> = { organizationId } as FindOptionsWhere<Lead>;
    if (status) where.status = status as Lead['status'];
    if (fitStatus) where.fitStatus = fitStatus as Lead['fitStatus'];
    if (source) where.source = source;
    if (clientId) where.clientId = clientId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }
}
