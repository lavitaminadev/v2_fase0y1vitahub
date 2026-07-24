import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';

@Injectable()
export class ListOpportunitiesUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
  ) {}

  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
    leadId?: string,
  ): Promise<{ data: Opportunity[]; total: number; limit: number; offset: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (leadId) where.leadId = leadId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }
}
