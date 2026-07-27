import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Piece } from '../production/piece.entity';

@Injectable()
export class ConfirmUdConsumptionUseCase {
  constructor(
    @InjectRepository(UDBudget) private budgetRepo: Repository<UDBudget>,
    @InjectRepository(UDMovement) private movementRepo: Repository<UDMovement>,
  ) {}

  async execute(organizationId: string, clientId: string, pieceId: string, year: number, month: number) {
    return this.budgetRepo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, {
        where: { id: pieceId, organizationId, clientId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!piece) throw new NotFoundException('Pieza no encontrada');

      const budget = await manager.findOne(UDBudget, {
        where: { clientId, year, month },
        lock: { mode: 'pessimistic_write' },
      });
      if (!budget) throw new NotFoundException('Presupuesto UD no encontrado.');

      const consumed = await manager.findOne(UDMovement, {
        where: { pieceId, type: UDMovementType.CONSUMPTION },
      });
      if (consumed) return budget;

      const reservation = await manager.findOne(UDMovement, {
        where: { pieceId, udBudgetId: budget.id, type: UDMovementType.RESERVATION },
      });
      if (!reservation) throw new BadRequestException('La pieza no tiene una reserva UD vigente para este período.');

      const pending = Number(reservation.amount);
      if (pending <= 0 || pending > Number(budget.reserved)) {
        throw new BadRequestException('La reserva UD de la pieza es inconsistente con el presupuesto.');
      }

      budget.reserved = Number(budget.reserved) - pending;
      budget.consumed = Number(budget.consumed) + pending;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId,
        type: UDMovementType.CONSUMPTION,
        amount: pending,
      });
      await manager.save(UDMovement, movement);

      return budget;
    });
  }
}
