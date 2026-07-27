import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
import { XPEvent } from './xp-event.entity';
import { XPEventType } from './xp-event-type.enum';
import { calculateDeliveryXp, calculateWeeklyTier } from './xp-calculator';
import { User } from '../users/user.entity';

@Injectable()
export class RegisterXpUseCase {
  constructor(
    @InjectRepository(XPPeriod) private periodRepo: Repository<XPPeriod>,
    @InjectRepository(XPEvent) private eventRepo: Repository<XPEvent>,
  ) {}

  /**
   * Verifica que el usuario al que se le registra XP pertenezca a la organización.
   *
   * El identificador llega en el cuerpo de la petición, por lo que su pertenencia debe
   * confirmarse antes de crear un período: un período con un usuario de otra organización
   * expondría sus datos a través del ranking.
   *
   * @throws NotFoundException si el usuario no pertenece a la organización.
   */
  private async assertUserBelongsToOrganization(
    manager: EntityManager,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const exists = await manager.getRepository(User).exist({ where: { id: userId, organizationId } });
    if (!exists) throw new NotFoundException('Usuario no encontrado');
  }

  async executeDelivery(params: {
    organizationId: string;
    userId: string;
    pieceId: string;
    difficultyLevel: number;
    actualHours: number;
    expectedHours?: number;
    perfectNaming: boolean;
    hadDesignerErrorCorrection: boolean;
    delayJustification?: string;
    description?: string;
    metadata?: Record<string, any>;
  }, transactionManager?: EntityManager) {
    const execute = async (manager: EntityManager) => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);

      await this.assertUserBelongsToOrganization(manager, params.userId, params.organizationId);

      let period = await manager.findOne(XPPeriod, {
        where: { userId: params.userId, weekStart, organizationId: params.organizationId },
      });
      if (!period) {
        period = manager.create(XPPeriod, {
          organizationId: params.organizationId,
          userId: params.userId,
          weekStart,
          weekEnd,
        });
        period = await manager.save(XPPeriod, period);
      }

      const points = calculateDeliveryXp(params);

      const event = manager.create(XPEvent, {
        xpPeriodId: period.id,
        userId: params.userId,
        pieceId: params.pieceId,
        eventType: XPEventType.BASE_DELIVERY,
        points,
        description: params.description,
        metadata: params.metadata,
      });
      await manager.save(XPEvent, event);

      period.totalXp = Number(period.totalXp) + points;
      period.tier = calculateWeeklyTier(period.totalXp) ?? undefined;
      return manager.save(XPPeriod, period);
    };
    return transactionManager ? execute(transactionManager) : this.periodRepo.manager.transaction(execute);
  }

  async executePenalty(params: {
    organizationId: string;
    userId: string;
    pieceId: string;
    points: number;
    eventType: XPEventType;
  }, transactionManager?: EntityManager) {
    const execute = async (manager: EntityManager) => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      await this.assertUserBelongsToOrganization(manager, params.userId, params.organizationId);

      let period = await manager.findOne(XPPeriod, {
        where: { userId: params.userId, weekStart, organizationId: params.organizationId },
      });
      if (!period) {
        period = manager.create(XPPeriod, { organizationId: params.organizationId, userId: params.userId, weekStart, weekEnd: new Date(weekStart.getTime() + 4 * 86400000) });
        period = await manager.save(XPPeriod, period);
      }

      const event = manager.create(XPEvent, {
        xpPeriodId: period.id,
        userId: params.userId,
        pieceId: params.pieceId,
        eventType: params.eventType,
        points: params.points,
      });
      await manager.save(XPEvent, event);

      period.totalXp = Math.max(0, Number(period.totalXp) + params.points);
      period.tier = calculateWeeklyTier(period.totalXp) ?? undefined;
      return manager.save(XPPeriod, period);
    };
    return transactionManager ? execute(transactionManager) : this.periodRepo.manager.transaction(execute);
  }
}
