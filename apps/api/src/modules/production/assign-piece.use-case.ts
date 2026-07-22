import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { calculatePieceUd } from '../design-budget/ud-calculator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { User } from '../users/user.entity';

@Injectable()
export class AssignPieceUseCase {
  constructor(
    @InjectRepository(Piece) private repo: Repository<Piece>,
    @InjectRepository(User) private users: Repository<User>,
    private designBudget: DesignBudgetService,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(pieceId: string, designerId: string, organizationId: string, actorId?: string) {
    const saved = await this.repo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, {
        where: { id: pieceId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!piece) throw new NotFoundException('Pieza no encontrada');
      if (piece.status === PieceStatus.DELIVERED) throw new BadRequestException('Una pieza entregada no se puede reasignar');
      const assignee = await manager.findOne(User, { where: { id: designerId, organizationId, isActive: true } });
      if (!assignee || !['designer', 'audiovisual', 'art_director'].includes(assignee.role)) {
        throw new BadRequestException('El responsable debe ser un usuario creativo activo de esta organizacion');
      }

      piece.assignedTo = designerId;
      piece.assignedAt = new Date();
      piece.startedAt = undefined;
      piece.status = PieceStatus.ASSIGNED;
      if (Number(piece.udAmount) <= 0) piece.udAmount = calculatePieceUd(piece.type);

      const assignedPiece = await manager.save(Piece, piece);
      await this.designBudget.reserveForPiece(assignedPiece, actorId, manager);
      return assignedPiece;
    });
    this.eventEmitter.emit('piece.assigned', { organizationId, pieceId: saved.id, designerId });
    return saved;
  }
}
