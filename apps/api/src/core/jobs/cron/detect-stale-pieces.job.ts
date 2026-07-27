import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { PieceStatus } from '../../../modules/production/piece-status.enum';
import { Notification } from '../../notifications/notification.entity';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

const DEFAULT_STALE_HOURS = 48;
const ACTIVE_STATUSES = [
  PieceStatus.ASSIGNED,
  PieceStatus.IN_PROGRESS,
  PieceStatus.INTERNAL_REVIEW,
  PieceStatus.CLIENT_VALIDATION,
  PieceStatus.CORRECTION,
];

@Injectable()
export class DetectStalePiecesJob {
  private readonly logger = new Logger(DetectStalePiecesJob.name);

  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private readonly parameters: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Detecting stale pieces...');
    const minimumCutoff = new Date(Date.now() - 3_600_000);

    const candidates = await this.pieceRepo
      .createQueryBuilder('p')
      .where('p.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('p.updated_at < :minimumCutoff', { minimumCutoff })
      .getMany();

    const hoursByOrganization = new Map<string, number>();
    let staleCount = 0;
    // try/catch por pieza: una pieza con datos raros no debe impedir detectar
    // el resto de las piezas estancadas en esta misma corrida.
    for (const piece of candidates) {
      try {
        let staleHours = hoursByOrganization.get(piece.organizationId);
        if (staleHours === undefined) {
          const configured = await this.parameters.get('production.stale_hours', null, null, piece.organizationId);
          staleHours = Number(configured ?? DEFAULT_STALE_HOURS);
          hoursByOrganization.set(piece.organizationId, staleHours);
        }
        const cutoff = new Date(Date.now() - staleHours * 3_600_000);
        if (piece.updatedAt >= cutoff || (piece.staleAlertedAt && piece.staleAlertedAt >= cutoff)) continue;

        piece.staleAlertedAt = new Date();
        await this.pieceRepo.save(piece);
        staleCount += 1;

        if (!piece.assignedTo) {
          this.logger.warn(`Stale piece without assignee: ${piece.id} - ${piece.title}`);
          continue;
        }

        const notif = this.notifRepo.create({
          userId: piece.assignedTo,
          organizationId: piece.organizationId,
          type: 'piece.stale',
          title: 'Pieza estancada',
          message: `La pieza "${piece.title}" lleva más de ${staleHours}h en estado "${piece.status}".`,
          data: { pieceId: piece.id, status: piece.status, hoursStale: staleHours },
        });
        await this.notifRepo.save(notif);

        this.logger.warn(`Stale piece: ${piece.id} - ${piece.title} (${piece.status})`);
      } catch (error) {
        this.logger.error(`Failed to process stale piece ${piece.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Found ${staleCount} stale pieces`);
  }
}
