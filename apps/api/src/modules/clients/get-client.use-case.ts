import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';

@Injectable()
export class GetClientUseCase {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
  ) {}

  async execute(id: string, organizationId: string) {
    const client = await this.repo.findOne({
      where: { id, organizationId },
      relations: ['lead'],
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }
}
