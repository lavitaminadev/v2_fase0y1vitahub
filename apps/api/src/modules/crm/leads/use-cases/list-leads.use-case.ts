import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
  ) {}

  async execute(organizationId: string, status?: string, fitStatus?: string, source?: string, clientId?: string) {
    const where: any = { organizationId };
    if (status) where.status = status;
    if (fitStatus) where.fitStatus = fitStatus;
    if (source) where.source = source;
    if (clientId) where.clientId = clientId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}
