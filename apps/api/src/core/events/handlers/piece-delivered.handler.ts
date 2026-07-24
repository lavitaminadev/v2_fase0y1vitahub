import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { PieceVersion } from '../../../modules/production/piece-version.entity';
import { Client } from '../../../modules/clients/client.entity';
import { Notification } from '../../notifications/notification.entity';

@Injectable()
export class PieceDeliveredHandler {
  private readonly logger = new Logger(PieceDeliveredHandler.name);

  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(PieceVersion) private versionRepo: Repository<PieceVersion>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  @OnEvent('piece.delivered')
  async handle(payload: { organizationId: string; pieceId: string }) {
    // Este handler actualiza el estado del ciclo mensual (account_cycles) ademas
    // de crear la notificacion: sin try/catch, un fallo en cualquier paso deja
    // el ciclo desincronizado y nadie se entera porque corre fuera del request HTTP.
    try {
      const piece = await this.pieceRepo.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
      if (!piece) return;

      const latestVersion = await this.versionRepo.findOne({
        where: { pieceId: piece.id },
        order: { versionNumber: 'DESC' },
      });

      if (latestVersion) {
        const isValid = /^[A-Z0-9]+_[A-Z-]+_[A-Z0-9-]+_v\d+_(FINAL|BORRADOR|REVISION)$/i.test(latestVersion.fileName);
        latestVersion.namingValid = isValid;
        latestVersion.namingErrors = isValid ? [] : ['El nombre del archivo no sigue la convencion establecida'];
        await this.versionRepo.save(latestVersion);
      }

      const period = piece.deliveredAt ?? new Date();
      const [remaining] = await this.pieceRepo.manager.query("SELECT COUNT(*) total FROM pieces WHERE organization_id = ? AND client_id = ? AND YEAR(created_at) = ? AND MONTH(created_at) = ? AND status <> 'delivered'", [piece.organizationId, piece.clientId, period.getFullYear(), period.getMonth() + 1]);
      await this.pieceRepo.manager.query('UPDATE account_cycles SET production_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [Number(remaining?.total ?? 0) === 0 ? 'completed' : 'in_progress', piece.organizationId, piece.clientId, period.getFullYear(), period.getMonth() + 1]);

      const client = await this.clientRepo.findOne({ where: { id: piece.clientId, organizationId: piece.organizationId } });
      if (!client?.communityManagerId) return;

      await this.notifRepo.save(this.notifRepo.create({
        organizationId: piece.organizationId,
        userId: client.communityManagerId,
        type: 'piece.delivered',
        title: 'Pieza entregada',
        message: `La pieza "${piece.title}" ha sido entregada al cliente.`,
        data: { pieceId: piece.id, clientId: piece.clientId },
      }));
    } catch (error) {
      this.logger.error(`Error procesando piece.delivered para pieza ${payload.pieceId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
