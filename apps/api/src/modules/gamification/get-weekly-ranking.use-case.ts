import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XPPeriod } from './xp-period.entity';

export function getCurrentWeekStart(now = new Date()): Date {
  const weekStart = new Date(now);
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

@Injectable()
export class GetWeeklyRankingUseCase {
  constructor(
    @InjectRepository(XPPeriod) private repo: Repository<XPPeriod>,
  ) {}

  async execute(organizationId: string) {
    const weekStart = getCurrentWeekStart();

    return this.repo.find({
      where: { organizationId, weekStart },
      order: { totalXp: 'DESC' },
      relations: ['user'],
    });
  }
}
