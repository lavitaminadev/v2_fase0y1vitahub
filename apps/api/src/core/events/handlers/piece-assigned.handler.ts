import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { Notification } from '../../notifications/notification.entity';

@Injectable()
export class PieceAssignedHandler {
  private readonly logger = new Logger(PieceAssignedHandler.name);

  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  @OnEvent('piece.assigned')
  async handle(payload: { organizationId: string; pieceId: string; designerId: string }) {
    // Sin try/catch, un error aqui (ej. FK invalida) queda como unhandled
    // rejection fuera del ciclo HTTP y nadie se entera de que la notificacion
    // de asignacion nunca se creo.
    try {
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
    } catch (error) {
      this.logger.error(`Error procesando piece.assigned para pieza ${payload.pieceId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
