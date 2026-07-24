import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { ContentGrid } from './content-grid.entity';

@Injectable()
export class ListContentGridsUseCase {
  constructor(
    @InjectRepository(ContentGrid) private repo: Repository<ContentGrid>,
  ) {}

  async execute(
    organizationId: string,
    clientId?: string,
    month?: string,
    clientVisibleOnly = false,
    clientIds?: string[],
  ) {
    const where: FindOptionsWhere<ContentGrid> = { organizationId } as FindOptionsWhere<ContentGrid>;
    if (clientId) where.clientId = clientId;
    if (!clientId && clientIds !== undefined) where.clientId = In(clientIds);
    // Sin filtro de mes se acota a las 200 parrillas mas recientes para evitar traer el historial completo.
    const hasMonthFilter = !!month && /^\d{4}-\d{2}$/.test(month);
    const grids = await this.repo.find({
      where,
      order: { weekStart: 'DESC' },
      relations: ['contentItems', 'client'],
      take: hasMonthFilter ? undefined : 200,
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
