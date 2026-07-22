import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from './client.entity';

@Injectable()
export class ListClientsUseCase {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
  ) {}

  async execute(organizationId: string, clientIds?: string[]) {
    return this.repo.find({
      where: { organizationId, ...(clientIds !== undefined ? { id: In(clientIds) } : {}) },
      order: { name: 'ASC' },
      relations: ['lead'],
    });
  }
}
