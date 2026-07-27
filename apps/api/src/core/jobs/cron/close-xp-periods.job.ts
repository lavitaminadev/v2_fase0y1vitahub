import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { XPPeriod } from '../../../modules/gamification/xp-period.entity';
import { XPEvent } from '../../../modules/gamification/xp-event.entity';
import { calculateWeeklyTier } from '../../../modules/gamification/xp-calculator';
import { XPEventType } from '../../../modules/gamification/xp-event-type.enum';

@Injectable()
export class CloseXpPeriodsJob {
  private readonly logger = new Logger(CloseXpPeriodsJob.name);

  constructor(
    @InjectRepository(XPPeriod) private periodRepo: Repository<XPPeriod>,
    @InjectRepository(XPEvent) private eventRepo: Repository<XPEvent>,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Closing weekly XP periods...');
    const now = new Date();
    const closeThrough = this.closeThrough(now);
    if (!closeThrough) return;

    const openPeriods = await this.periodRepo.find({
      where: { status: 'open', weekEnd: LessThanOrEqual(closeThrough) },
    });

    // try/catch por periodo: un error calculando el XP de un diseñador (ej. datos
    // inconsistentes) no debe dejar sin cerrar los periodos del resto del equipo.
    for (const period of openPeriods) {
      try {
        const result = await this.eventRepo
          .createQueryBuilder('e')
          .select('COALESCE(SUM(e.points), 0)', 'total')
          .where('e.xp_period_id = :periodId', { periodId: period.id })
          .getRawOne();

        const penaltyCount = await this.eventRepo.count({ where: { xpPeriodId: period.id, eventType: XPEventType.CORRECTION_PENALTY } });
        if (penaltyCount === 0) {
          await this.eventRepo.save(this.eventRepo.create({ xpPeriodId: period.id, userId: period.userId, eventType: XPEventType.NO_ERROR_WEEK_BONUS, points: 15, description: 'Semana cerrada sin correcciones atribuibles al diseñador' }));
        }
        const totalXp = Number(result?.total ?? 0) + (penaltyCount === 0 ? 15 : 0);
        const tier = calculateWeeklyTier(totalXp);

        await this.periodRepo.update(period.id, {
          status: 'closed',
          totalXp,
          tier: tier ?? undefined,
          closedAt: new Date(),
        });

        this.logger.log(`Closed period ${period.id}: ${totalXp} XP, tier ${tier ?? 'none'}`);
      } catch (error) {
        this.logger.error(`Failed to close XP period ${period.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Closed ${openPeriods.length} periods`);
  }

  private closeThrough(date: Date): Date | null {
    const current = new Date(date);
    const day = current.getDay();
    if (day === 5 && current.getHours() < 18) {
      current.setDate(current.getDate() - 7);
    } else if (day < 5 && day !== 0) {
      current.setDate(current.getDate() - (day + 2));
    } else if (day === 0) {
      current.setDate(current.getDate() - 2);
    } else if (day === 6) {
      current.setDate(current.getDate() - 1);
    }
    current.setHours(0, 0, 0, 0);
    return current;
  }
}
