import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';

@Injectable()
export class GetLeadUseCase {
  constructor(
    @InjectRepository(Lead) private readonly repo: Repository<Lead>,
  ) {}

  async execute(id: string, organizationId: string): Promise<Lead> {
    const lead = await this.repo.findOne({ where: { id, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
