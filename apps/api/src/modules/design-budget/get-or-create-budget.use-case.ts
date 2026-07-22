import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Client } from '../clients/client.entity';

@Injectable()
export class GetOrCreateBudgetUseCase {
  constructor(
    @InjectRepository(UDBudget) private repo: Repository<UDBudget>,
    @InjectRepository(Client) private clients: Repository<Client>,
  ) {}

  async execute(organizationId: string, clientId: string, year: number, month: number, defaultBudget = 20) {
    return this.repo.manager.transaction(async (manager) => {
      const client = await manager.findOne(Client, {
        where: { id: clientId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!client) throw new NotFoundException('Cliente no encontrado');

      const existing = await manager.findOne(UDBudget, { where: { clientId, year, month } });
      if (existing) return existing;

      const budget = manager.create(UDBudget, {
        clientId, year, month,
        contracted: defaultBudget,
      });
      return manager.save(UDBudget, budget);
    });
  }
}
