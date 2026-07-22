import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Piece } from '../production/piece.entity';

@Injectable()
export class ReserveUdUseCase {
  constructor(
    @InjectRepository(UDBudget) private budgetRepo: Repository<UDBudget>,
    @InjectRepository(UDMovement) private movementRepo: Repository<UDMovement>,
  ) {}

  async execute(organizationId: string, clientId: string, pieceId: string, amount: number, year: number, month: number) {
    return this.budgetRepo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, {
        where: { id: pieceId, organizationId, clientId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!piece) throw new NotFoundException('Pieza no encontrada');
      if (Math.abs(Number(piece.udAmount) - amount) > 0.001) {
        throw new BadRequestException('La cantidad UD debe coincidir con el costo calculado de la pieza');
      }

      const budget = await manager.findOne(UDBudget, {
        where: { clientId, year, month },
        lock: { mode: 'pessimistic_write' },
      });
      if (!budget) throw new NotFoundException('Presupuesto UD no encontrado. Cree el presupuesto primero.');

      const existing = await manager.findOne(UDMovement, {
        where: { pieceId, type: UDMovementType.RESERVATION },
      });
      if (existing) {
        if (existing.udBudgetId !== budget.id) throw new BadRequestException('La pieza ya tiene una reserva en otro período');
        return budget;
      }

      const available = Number(budget.contracted) - Number(budget.reserved) - Number(budget.consumed);
      if (amount > available) throw new BadRequestException(`UD insuficientes. Disponibles: ${available}, requeridas: ${amount}`);

      budget.reserved = Number(budget.reserved) + amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId,
        type: UDMovementType.RESERVATION,
        amount,
      });
      await manager.save(UDMovement, movement);

      return budget;
    });
  }
}
