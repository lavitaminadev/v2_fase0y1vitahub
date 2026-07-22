import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AccountCycle } from './account-cycle.entity';

@Injectable()
export class AccountCyclesService {
  constructor(@InjectRepository(AccountCycle) private readonly cycles: Repository<AccountCycle>) {}

  async ensure(organizationId: string, clientId: string, year: number, month: number): Promise<AccountCycle> {
    const existing = await this.cycles.findOne({ where: { organizationId, clientId, year, month } });
    if (existing) return existing;
    const startedAt = new Date(year, month - 1, 1);
    const endsAt = new Date(year, month, 0);
    return this.cycles.save(this.cycles.create({ organizationId, clientId, year, month, startedAt, endsAt }));
  }

  list(organizationId: string, year?: number, month?: number, clientIds?: string[]): Promise<AccountCycle[]> {
    const where: FindOptionsWhere<AccountCycle> = {
      organizationId,
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
      ...(clientIds !== undefined ? { clientId: In(clientIds) } : {}),
    };
    return this.cycles.find({
      where,
      order: { year: 'DESC', month: 'DESC', createdAt: 'DESC' },
      relations: { client: true },
    });
  }

  async update(id: string, organizationId: string, patch: Partial<AccountCycle>, clientIds?: string[]): Promise<AccountCycle> {
    if (clientIds?.length === 0) throw new NotFoundException('Account cycle not found');
    const cycle = await this.cycles.findOne({
      where: { id, organizationId, ...(clientIds !== undefined ? { clientId: In(clientIds) } : {}) },
    });
    if (!cycle) throw new NotFoundException('Account cycle not found');
    const allowed = ['status', 'gridStatus', 'productionStatus', 'weeklyMeetingsCompleted', 'strategyMeetingStatus', 'reportStatus'];
    for (const key of allowed) if (patch[key as keyof AccountCycle] !== undefined) (cycle as any)[key] = patch[key as keyof AccountCycle];
    if (cycle.status === 'closed' && !cycle.closedAt) cycle.closedAt = new Date();
    return this.cycles.save(cycle);
  }
}
