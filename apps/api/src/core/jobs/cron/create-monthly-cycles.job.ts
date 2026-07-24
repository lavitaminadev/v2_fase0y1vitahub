import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../../modules/clients/client.entity';
import { ClientStatus } from '../../../modules/clients/client-status.enum';
import { UDBudget } from '../../../modules/design-budget/ud-budget.entity';
import { AccountCyclesService } from '../../../modules/account-cycles/account-cycles.service';

@Injectable()
export class CreateMonthlyCyclesJob {
  private readonly logger = new Logger(CreateMonthlyCyclesJob.name);

  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(UDBudget) private budgetRepo: Repository<UDBudget>,
    private readonly cycles: AccountCyclesService,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Creating monthly account cycles...');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const activeClients = await this.clientRepo.find({
      where: { status: ClientStatus.ACTIVE },
    });

    let created = 0;
    // try/catch per client: one client with bad/missing data must not abort the
    // whole run and leave every client after it without a cycle for this month.
    for (const client of activeClients) {
      try {
        await this.cycles.ensure(client.organizationId, client.id, year, month);
        const existing = await this.budgetRepo.findOne({
          where: { clientId: client.id, year, month },
        });
        if (existing) continue;

        const budget = this.budgetRepo.create({
          clientId: client.id,
          year,
          month,
          contracted: client.defaultUdBudget ?? 20,
          reserved: 0,
          consumed: 0,
          status: 'open',
        });
        await this.budgetRepo.save(budget);
        created++;
      } catch (error) {
        this.logger.error(`Failed to create monthly cycle for client ${client.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Created ${created} UD budgets for ${year}-${month}`);
  }
}
