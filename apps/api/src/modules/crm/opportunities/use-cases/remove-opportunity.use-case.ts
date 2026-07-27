import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { GetOpportunityUseCase } from './get-opportunity.use-case';

@Injectable()
export class RemoveOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly getOpportunity: GetOpportunityUseCase,
  ) {}

  async execute(id: string, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.getOpportunity.execute(id, organizationId);
    return this.repo.remove(opportunity);
  }
}
