import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';

@Injectable()
export class GetOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
  ) {}

  async execute(id: string, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.repo.findOne({ where: { id, organizationId } });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity;
  }
}
