import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
import { XPEvent } from './xp-event.entity';
import { XPEventType } from './xp-event-type.enum';
import { Piece } from '../production/piece.entity';
import { RegisterXpUseCase } from './register-xp.use-case';
import { EXPECTED_HOURS } from './xp-calculator';

@Injectable()
export class XPService {
  constructor(
    @InjectRepository(XPPeriod) private periodRepo: Repository<XPPeriod>,
    @InjectRepository(XPEvent) private eventRepo: Repository<XPEvent>,
    private registerXp: RegisterXpUseCase,
  ) {}

  async registerDelivery(piece: Piece, designerId: string, deliveredAt: Date, manager?: EntityManager): Promise<void> {
    const level = piece.difficultyLevel ?? 1;
    const expectedHours = this.expectedHoursForLevel(level);
    const elapsedHours = this.hoursDiff(piece.startedAt ?? piece.assignedAt ?? piece.createdAt, deliveredAt);

    const queryManager = manager ?? this.eventRepo.manager;
    const namingValid = await queryManager
      .createQueryBuilder()
      .select('pv.naming_valid', 'valid')
      .from('piece_versions', 'pv')
      .where('pv.piece_id = :pieceId', { pieceId: piece.id })
      .andWhere('pv.naming_valid IS NOT NULL')
      .orderBy('pv.version_number', 'DESC')
      .getRawOne();

    const hadDesignerError = await queryManager
      .createQueryBuilder()
      .select('1')
      .from('corrections', 'c')
      .where('c.piece_id = :pieceId', { pieceId: piece.id })
      .andWhere('c.origin = :origin', { origin: 'designer_error' })
      .getRawOne();

    await this.registerXp.executeDelivery({
      organizationId: piece.organizationId,
      userId: designerId,
      pieceId: piece.id,
      difficultyLevel: level,
      actualHours: elapsedHours,
      expectedHours,
      perfectNaming: namingValid?.valid === true,
      hadDesignerErrorCorrection: !!hadDesignerError,
    }, manager);
  }

  async registerDesignerErrorPenalty(piece: Piece, designerId: string, manager?: EntityManager): Promise<void> {
    await this.registerXp.executePenalty({
      organizationId: piece.organizationId,
      userId: designerId,
      pieceId: piece.id,
      points: -5,
      eventType: XPEventType.CORRECTION_PENALTY,
    }, manager);
  }

  async ensurePeriod(userId: string, date: Date): Promise<XPPeriod> {
    const start = this.startOfWeek(date);
    const end = this.endOfWeek(date);

    const existing = await this.periodRepo.findOne({ where: { userId, weekStart: start } });
    if (existing) return existing;

    const period = this.periodRepo.create({
      userId,
      weekStart: start,
      weekEnd: end,
      status: 'open',
      totalXp: 0,
    });
    return this.periodRepo.save(period);
  }

  protected expectedHoursForLevel(level: number): number {
    return EXPECTED_HOURS[level] ?? 1;
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfWeek(date: Date): Date {
    const d = this.startOfWeek(date);
    d.setDate(d.getDate() + 4);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  private hoursDiff(a: Date, b: Date): number {
    return Math.abs(b.getTime() - a.getTime()) / 36_000_000;
  }
}
