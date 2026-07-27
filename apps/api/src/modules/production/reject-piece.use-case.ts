import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { Correction } from './correction.entity';
import { PieceStatus } from './piece-status.enum';
import { CorrectionOrigin } from './correction-origin.enum';
import { PieceRulesService } from './piece-rules.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '../organizations/user-role.enum';

@Injectable()
export class RejectPieceUseCase {
  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    private pieceRules: PieceRulesService,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(
    pieceId: string,
    organizationId: string,
    data: { versionId?: string; comment: string; origin: CorrectionOrigin; userId: string; role: UserRole; clientId?: string },
  ) {
    const saved = await this.pieceRepo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, { where: { id: pieceId, organizationId } });
      if (!piece) throw new NotFoundException('Pieza no encontrada');

      if (data.role === UserRole.CLIENT) {
        if (!data.clientId || piece.clientId !== data.clientId) throw new NotFoundException('Pieza no encontrada');
        if (piece.status !== PieceStatus.CLIENT_VALIDATION) throw new BadRequestException('La pieza no está pendiente de validación del cliente');
        data.origin = CorrectionOrigin.CLIENT_REQUEST;
      } else if (![PieceStatus.INTERNAL_REVIEW, PieceStatus.CLIENT_VALIDATION].includes(piece.status)) {
        throw new BadRequestException('La pieza no está en una etapa de revisión');
      }

      if (data.versionId) {
        const version = await manager.findOne(PieceVersion, { where: { id: data.versionId, pieceId } });
        if (!version) throw new ForbiddenException('La versión no pertenece a esta pieza');
      }

      const isDesignerError = data.origin === CorrectionOrigin.DESIGNER_ERROR;
      const currentCount = data.origin === CorrectionOrigin.CLIENT_REQUEST ? piece.clientCorrectionCount : piece.correctionCount;
      const { allowed, reason } = await this.pieceRules.canRequestCorrection(currentCount, isDesignerError, organizationId);
      if (!allowed) throw new BadRequestException(reason);

      piece.correctionCount += 1;
      if (data.origin === CorrectionOrigin.CLIENT_REQUEST) {
        piece.clientCorrectionCount += 1;
      }
      piece.status = PieceStatus.CORRECTION;
      await manager.save(Piece, piece);

      const shouldGenerateChargeNote = data.origin === CorrectionOrigin.CLIENT_REQUEST
        && await this.pieceRules.shouldGenerateInvoice(piece.clientCorrectionCount, organizationId);

      const correction = manager.create(Correction, {
        pieceId,
        pieceVersionId: data.versionId,
        origin: data.origin,
        description: data.comment,
        requestedBy: data.userId,
        billableExtra: shouldGenerateChargeNote,
        chargeNoteRequired: shouldGenerateChargeNote,
      });
      const saved = await manager.save(Correction, correction);

      return saved;
    });
    this.eventEmitter.emit('piece.rejected', { organizationId, pieceId, correctionId: saved.id, origin: data.origin, requestedBy: data.userId });
    return saved;
  }
}
