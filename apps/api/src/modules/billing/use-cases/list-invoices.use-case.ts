import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @InjectRepository(Invoice) private readonly repo: Repository<Invoice>,
  ) {}

  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: Invoice[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId },
      order: { issuedAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }
}
