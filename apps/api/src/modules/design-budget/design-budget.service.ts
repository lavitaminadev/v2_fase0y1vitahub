import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Piece } from '../production/piece.entity';
import { Client } from '../clients/client.entity';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { calculatePieceUd } from './ud-calculator';
import { BudgetAlertDto } from './dto/budget-alert.dto';

@Injectable()
export class DesignBudgetService {
  constructor(
    @InjectRepository(UDBudget) private budgetRepo: Repository<UDBudget>,
    @InjectRepository(UDMovement) private movementRepo: Repository<UDMovement>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private parameterResolver: ParameterResolver,
  ) {}

  async ensureMonthlyBudget(clientId: string, year: number, month: number, manager?: EntityManager): Promise<UDBudget> {
    const repo = manager?.getRepository(UDBudget) ?? this.budgetRepo;
    const existing = await repo.findOne({ where: { clientId, year, month } });
    if (existing) return existing;

    const contracted = await this.resolveMonthlyBudget(clientId);
    const budget = repo.create({
      clientId, year, month,
      contracted,
      reserved: 0,
      consumed: 0,
      status: 'open',
    });
    return repo.save(budget);
  }

  calculateForPiece(pieceType: string, carouselSlides = 0): number {
    return calculatePieceUd(pieceType, carouselSlides);
  }

  async reserveForPiece(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement> {
    const execute = async (manager: EntityManager) => {
      await manager.findOne(Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
      await manager.findOne(Client, { where: { id: piece.clientId }, lock: { mode: 'pessimistic_write' } });
      const movementRepo = manager.getRepository(UDMovement);
      const existingMovement = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RESERVATION },
      });
      if (existingMovement) return existingMovement;
      const date = piece.createdAt;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const ensuredBudget = await this.ensureMonthlyBudget(piece.clientId, year, month, manager);
      const budget = await manager.findOneOrFail(UDBudget, {
        where: { id: ensuredBudget.id },
        lock: { mode: 'pessimistic_write' },
      });
      const amount = piece.udAmount;

      const used = Number(budget.reserved) + Number(budget.consumed);
      const available = Number(budget.contracted) - used;
      if (amount > available) {
        const limitAction = await this.parameterResolver.get('ud.limit_action', piece.clientId, null, piece.organizationId);
        if ((limitAction ?? 'block') === 'block') {
          throw new BadRequestException(`UD insuficientes. Disponibles: ${available}, requeridas: ${amount}`);
        }
      }

      budget.reserved = Number(budget.reserved) + amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId: piece.id,
        type: UDMovementType.RESERVATION,
        amount,
        reason: `Reserva por asignación de pieza ${piece.title}`,
        actorId,
      });
      return manager.save(UDMovement, movement);
    };
    return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
  }

  async confirmConsumption(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement> {
    const execute = async (manager: EntityManager) => {
      await manager.findOne(Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
      const movementRepo = manager.getRepository(UDMovement);
      const existingMovement = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.CONSUMPTION },
      });
      if (existingMovement) return existingMovement;
      const reservation = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RESERVATION },
      });
      const budget = reservation
        ? await manager.findOne(UDBudget, { where: { id: reservation.udBudgetId } })
        : null;

      if (!reservation || !budget) {
        throw new BadRequestException('La pieza no tiene una reserva de UD vigente. Vuelve a asignarla antes de entregar.');
      }
      await manager.findOne(UDBudget, { where: { id: budget.id }, lock: { mode: 'pessimistic_write' } });
      const amount = piece.udAmount;

      if (amount > Number(budget.reserved)) {
        throw new BadRequestException(`UD reservadas insuficientes para confirmar. Reservadas: ${budget.reserved}, a consumir: ${amount}`);
      }

      budget.reserved = Number(budget.reserved) - amount;
      budget.consumed = Number(budget.consumed) + amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId: piece.id,
        type: UDMovementType.CONSUMPTION,
        amount,
        reason: `Consumo confirmado por entrega de pieza ${piece.title}`,
        actorId,
      });
      return manager.save(UDMovement, movement);
    };
    return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
  }

  async isNearLimit(budget: UDBudget, thresholdPercent?: number): Promise<boolean> {
    const organizationId = await this.resolveOrganizationId(budget.clientId);
    const threshold = thresholdPercent ?? (await this.parameterResolver.get('ud.warning_threshold_percent', budget.clientId, null, organizationId)) ?? 80;
    const used = Number(budget.reserved) + Number(budget.consumed);
    const total = Number(budget.contracted);

    if (total <= 0) return false;

    return (used / total) >= (threshold / 100);
  }

  async checkBudgetAlert(clientId: string, clientName?: string): Promise<BudgetAlertDto> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const budget = await this.ensureMonthlyBudget(clientId, year, month);

    const used = Number(budget.reserved) + Number(budget.consumed);
    const total = Number(budget.contracted);
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    const organizationId = await this.resolveOrganizationId(clientId);
    const warningThreshold = Number(
      await this.parameterResolver.get('ud.warning_threshold_percent', clientId, null, organizationId) ?? 80,
    );

    let status: BudgetAlertDto['status'] = 'ok';
    if (used >= total) {
      status = 'blocked';
    } else if (percentage >= warningThreshold) {
      status = 'warning';
    }

    return { clientId, clientName, used, total, percentage, status };
  }

  private async resolveMonthlyBudget(clientId: string): Promise<number> {
    const fromParam = await this.parameterResolver.get('ud.default_monthly_budget', clientId);
    return Number(fromParam ?? 20);
  }

  private async resolveOrganizationId(clientId: string): Promise<string | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId }, select: { organizationId: true } });
    return client?.organizationId ?? null;
  }
}
