import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { XPService } from '../gamification/xp.service';

@Injectable()
export class DeliverPieceUseCase {
  constructor(
    @InjectRepository(Piece) private repo: Repository<Piece>,
    private designBudget: DesignBudgetService,
    private xp: XPService,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(pieceId: string, organizationId: string, actorId?: string) {
    const saved = await this.repo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, { where: { id: pieceId, organizationId } });
      if (!piece) throw new NotFoundException('Pieza no encontrada');
      if (piece.status !== PieceStatus.APPROVED) throw new BadRequestException('La pieza debe estar aprobada antes de entregarse');

      const deliveredAt = new Date();
      piece.status = PieceStatus.DELIVERED;
      piece.deliveredAt = deliveredAt;
      const deliveredPiece = await manager.save(Piece, piece);
      await this.designBudget.confirmConsumption(deliveredPiece, actorId, manager);
      if (deliveredPiece.assignedTo) {
        await this.xp.registerDelivery(deliveredPiece, deliveredPiece.assignedTo, deliveredAt, manager);
      }

      return deliveredPiece;
    });
    this.eventEmitter.emit('piece.delivered', { organizationId, pieceId: saved.id });
    return saved;
  }
}
