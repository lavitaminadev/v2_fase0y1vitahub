import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../organizations/user-role.enum';
import { calculateWeeklyTier } from './xp-calculator';
import { XPDispute } from './xp-dispute.entity';
import { XPEvent } from './xp-event.entity';
import { XPEventType } from './xp-event-type.enum';
import { XPPeriod } from './xp-period.entity';
import { CreateXpDisputeDto, ResolveXpDisputeDto } from './dto/xp-dispute.dto';

@Injectable()
export class XpDisputesService {
  constructor(
    @InjectRepository(XPDispute) private readonly disputes: Repository<XPDispute>,
    @InjectRepository(XPPeriod) private readonly periods: Repository<XPPeriod>,
  ) {}

  list(organizationId: string, userId: string, role: UserRole) {
    const canResolve = [UserRole.ADMIN, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.OPERATIONS_DIRECTOR].includes(role);
    return this.disputes.find({ where: { organizationId, ...(canResolve ? {} : { userId }) }, relations: ['user', 'period'], order: { createdAt: 'DESC' }, take: 100 });
  }

  async create(organizationId: string, userId: string, dto: CreateXpDisputeDto): Promise<XPDispute> {
    const period = await this.periods.findOne({ where: { id: dto.xpPeriodId, organizationId, userId } });
    if (!period) throw new NotFoundException('Período XP no encontrado');
    const pending = await this.disputes.findOne({ where: { organizationId, xpPeriodId: period.id, userId, status: 'pending' } });
    if (pending) throw new BadRequestException('Ya existe una revisión pendiente para este período');
    return this.disputes.save(this.disputes.create({ organizationId, xpPeriodId: period.id, userId, message: dto.message.trim(), status: 'pending' }));
  }

  async resolve(id: string, organizationId: string, actorId: string, dto: ResolveXpDisputeDto): Promise<XPDispute> {
    return this.disputes.manager.transaction(async (manager) => {
      const dispute = await manager.findOne(XPDispute, { where: { id, organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!dispute) throw new NotFoundException('Solicitud de revisión no encontrada');
      if (dispute.status !== 'pending') throw new BadRequestException('La solicitud ya fue resuelta');
      dispute.status = dto.status; dispute.resolution = dto.resolution.trim(); dispute.adjustmentPoints = dto.status === 'accepted' ? dto.adjustmentPoints : 0; dispute.resolvedBy = actorId; dispute.resolvedAt = new Date();
      if (dispute.adjustmentPoints !== 0) {
        const period = await manager.findOne(XPPeriod, { where: { id: dispute.xpPeriodId, organizationId }, lock: { mode: 'pessimistic_write' } });
        if (!period) throw new NotFoundException('Período XP no encontrado');
        await manager.save(XPEvent, manager.create(XPEvent, { xpPeriodId: period.id, userId: dispute.userId, eventType: XPEventType.MANUAL_ADJUSTMENT, points: dispute.adjustmentPoints, description: dispute.resolution, metadata: { disputeId: dispute.id, resolvedBy: actorId } }));
        period.totalXp = Math.max(0, Number(period.totalXp) + dispute.adjustmentPoints); period.tier = calculateWeeklyTier(period.totalXp) ?? undefined; await manager.save(XPPeriod, period);
      }
      return manager.save(XPDispute, dispute);
    });
  }
}
