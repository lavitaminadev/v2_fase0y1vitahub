import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContentGrid } from './content-grid.entity';

@Injectable()
export class ListContentGridsUseCase {
  constructor(
    @InjectRepository(ContentGrid) private repo: Repository<ContentGrid>,
  ) {}

  async execute(organizationId: string, clientId?: string, month?: string, clientVisibleOnly = false, clientIds?: string[]) {
    const where: any = { organizationId };
    if (clientId) where.clientId = clientId;
    if (!clientId && clientIds !== undefined) where.clientId = In(clientIds);
    const grids = await this.repo.find({
      where,
      order: { weekStart: 'DESC' },
      relations: ['contentItems', 'client'],
    });
    const visibleGrids = clientVisibleOnly
      ? grids.filter((grid) => ['submitted', 'approved', 'published'].includes(grid.status))
      : grids;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return visibleGrids;
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return visibleGrids.filter((grid) => new Date(grid.weekStart) < end && new Date(grid.weekEnd) >= start);
  }
}
