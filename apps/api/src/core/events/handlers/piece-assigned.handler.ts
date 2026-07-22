import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { Notification } from '../../notifications/notification.entity';

@Injectable()
export class PieceAssignedHandler {
  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  @OnEvent('piece.assigned')
  async handle(payload: { organizationId: string; pieceId: string; designerId: string }) {
    const piece = await this.pieceRepo.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
    if (!piece) return;

    await this.notifRepo.save(this.notifRepo.create({
      organizationId: piece.organizationId,
      userId: payload.designerId,
      type: 'piece.assigned',
      title: 'Nueva pieza asignada',
      message: `Se te ha asignado la pieza "${piece.title}".`,
      data: { pieceId: piece.id, clientId: piece.clientId },
    }));
  }
}
