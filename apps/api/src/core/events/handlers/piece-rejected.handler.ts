import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '../../../modules/billing/billing.service';
import { Correction } from '../../../modules/production/correction.entity';
import { Piece } from '../../../modules/production/piece.entity';

@Injectable()
export class PieceRejectedHandler {
  constructor(
    @InjectRepository(Correction) private readonly corrections: Repository<Correction>,
    @InjectRepository(Piece) private readonly pieces: Repository<Piece>,
    private readonly billing: BillingService,
  ) {}

  @OnEvent('piece.rejected')
  async handle(payload: { organizationId: string; pieceId: string; correctionId: string; requestedBy?: string }) {
    const correction = await this.corrections.findOne({ where: { id: payload.correctionId, pieceId: payload.pieceId } });
    if (!correction?.chargeNoteRequired) return;
    const piece = await this.pieces.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
    if (!piece) return;
    const existing = await this.corrections.manager.query('SELECT id FROM charge_notes WHERE correction_id = ? LIMIT 1', [correction.id]);
    if (existing.length) return;
    await this.billing.createCorrectionCharge({ organizationId: piece.organizationId, clientId: piece.clientId, pieceId: piece.id, correctionId: correction.id, correctionNumber: piece.clientCorrectionCount, createdBy: payload.requestedBy });
  }
}
