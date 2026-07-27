import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from './client.entity';

@Injectable()
export class ListClientsUseCase {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
  ) {}

  async execute(
    organizationId: string,
    clientIds?: string[],
    limit = 20,
    offset = 0,
  ): Promise<{ data: Client[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId, ...(clientIds !== undefined ? { id: In(clientIds) } : {}) },
      order: { name: 'ASC' },
      relations: ['lead'],
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }
}
