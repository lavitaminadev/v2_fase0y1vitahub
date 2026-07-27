import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalRequestStatus } from './approval-request-status.enum';
import { Piece } from '../production/piece.entity';
import { PieceStatus } from '../production/piece-status.enum';
import { UserRole } from '../organizations/user-role.enum';
import { Correction } from '../production/correction.entity';
import { CorrectionOrigin } from '../production/correction-origin.enum';
import { PieceVersion } from '../production/piece-version.entity';
import { PieceRulesService } from '../production/piece-rules.service';

@Injectable()
export class UpdateApprovalStatusUseCase {
  constructor(
    @InjectRepository(ApprovalRequest) private repo: Repository<ApprovalRequest>,
    private readonly pieceRules: PieceRulesService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    id: string,
    organizationId: string,
    actor: { userId?: string; role: UserRole; clientId?: string },
    status: string,
    decisionNotes?: string,
  ) {
    if (![ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED].includes(status as ApprovalRequestStatus)) {
      throw new BadRequestException('La decisión debe ser approved o rejected');
    }
    const notes = decisionNotes?.trim();
    if (status === ApprovalRequestStatus.REJECTED && !notes) {
      throw new BadRequestException('Debes indicar el motivo de la corrección');
    }

    const result = await this.repo.manager.transaction(async (manager: EntityManager) => {
      const approval = await manager.findOne(ApprovalRequest, { where: { id, organizationId } });
      if (!approval) throw new NotFoundException('Approval request not found');
      if (actor.role === UserRole.CLIENT && approval.clientId !== actor.clientId) {
        throw new NotFoundException('Approval request not found');
      }
      if (![ApprovalRequestStatus.PENDING, ApprovalRequestStatus.VIEWED].includes(approval.status)) {
        throw new BadRequestException('Esta solicitud ya fue resuelta');
      }

      approval.status = status as ApprovalRequestStatus;
      approval.decisionAt = new Date();
      approval.decisionNotes = notes || undefined;
      if (actor.userId) approval.assignedTo = actor.userId;

      let correctionEvent: { pieceId: string; correctionId: string; origin: CorrectionOrigin } | undefined;
      if (approval.entityType === 'piece') {
        const piece = await manager.findOne(Piece, { where: { id: approval.entityId, organizationId } });
        if (!piece) throw new NotFoundException('Piece not found');
        if (piece.status !== PieceStatus.CLIENT_VALIDATION) {
          throw new BadRequestException('La pieza ya no está pendiente de validación');
        }

        if (status === ApprovalRequestStatus.APPROVED) {
          piece.status = PieceStatus.APPROVED;
        } else {
          const origin = actor.role === UserRole.CLIENT
            ? CorrectionOrigin.CLIENT_REQUEST
            : CorrectionOrigin.INTERNAL_FEEDBACK;
          const currentCount = origin === CorrectionOrigin.CLIENT_REQUEST
            ? piece.clientCorrectionCount
            : piece.correctionCount;
          const rule = await this.pieceRules.canRequestCorrection(currentCount, false, organizationId);
          if (!rule.allowed) throw new BadRequestException(rule.reason);

          piece.correctionCount += 1;
          if (origin === CorrectionOrigin.CLIENT_REQUEST) piece.clientCorrectionCount += 1;
          piece.status = PieceStatus.CORRECTION;

          const latestVersion = await manager.findOne(PieceVersion, {
            where: { pieceId: piece.id },
            order: { versionNumber: 'DESC' },
          });
          const billable = origin === CorrectionOrigin.CLIENT_REQUEST
            && await this.pieceRules.shouldGenerateInvoice(piece.clientCorrectionCount, organizationId);
          const correction = await manager.save(Correction, manager.create(Correction, {
            pieceId: piece.id,
            pieceVersionId: latestVersion?.id,
            origin,
            description: notes!,
            requestedBy: actor.userId,
            billableExtra: billable,
            chargeNoteRequired: billable,
          }));
          correctionEvent = { pieceId: piece.id, correctionId: correction.id, origin };
        }
        await manager.save(Piece, piece);
      }

      return { approval: await manager.save(ApprovalRequest, approval), correctionEvent };
    });

    if (result.correctionEvent) this.events.emit('piece.rejected', result.correctionEvent);
    return result.approval;
  }
}
