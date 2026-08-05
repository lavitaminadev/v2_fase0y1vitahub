import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { PieceVersion } from '../production/piece-version.entity';

/**
 * Tope de solicitudes devueltas.
 *
 * La pantalla muestra lo que hay que revisar, no el archivo histórico: sin cota, dos años de
 * operación se traían enteros en cada carga, con sus relaciones, y se recorrían dos veces por
 * cada fila. Node es de un solo hilo, así que ese trabajo bloqueaba a todos los usuarios del
 * proceso, no solo a quien abrió la pantalla.
 */
const MAX_APPROVALS = 200;

function buildVersionUrl(driveFileId?: string): string | undefined {
  if (!driveFileId) return undefined;
  return `https://drive.google.com/file/d/${driveFileId}/view`;
}

/** Agrupa por una clave, conservando el orden de llegada dentro de cada grupo. */
function groupBy<T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (value === undefined) continue;
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

@Injectable()
export class ListApprovalsUseCase {
  constructor(
    @InjectRepository(ApprovalRequest) private repo: Repository<ApprovalRequest>,
    @InjectRepository(PieceVersion) private versionRepo: Repository<PieceVersion>,
  ) {}

  async execute(organizationId: string, clientId?: string, clientIds?: string[]) {
    const where: any = { organizationId };
    if (clientId) where.clientId = clientId;
    if (!clientId && clientIds !== undefined) where.clientId = In(clientIds);
    const approvals = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['client', 'requestedByUser'],
      take: MAX_APPROVALS,
    });
    const pieceIds = [...new Set(approvals.filter((approval) => approval.entityType === 'piece').map((approval) => approval.entityId))];
    const versions = pieceIds.length ? await this.versionRepo.find({ where: { pieceId: In(pieceIds) }, order: { versionNumber: 'DESC' } }) : [];

    // Se agrupa una sola vez en vez de recorrer las listas completas por cada fila: el coste
    // pasa de crecer con el cuadrado del número de solicitudes a crecer con su número.
    const versionsByPiece = groupBy(versions, (version) => version.pieceId);
    const approvalsByEntity = groupBy(approvals, (approval) => approval.entityId);

    return approvals.map((a) => {
      const pieceVersions = versionsByPiece.get(a.entityId) ?? [];
      const latestVersion = pieceVersions[0];
      const decisionHistory = (approvalsByEntity.get(a.entityId) ?? []).map((related) => ({ id: related.id, status: related.status, notes: related.decisionNotes, requestedAt: related.createdAt.toISOString(), decidedAt: related.decisionAt?.toISOString(), requestedBy: related.requestedByUser?.name || 'Usuario no disponible' }));

      return {
        id: a.id,
        pieceId: a.entityId,
        pieceTitle: a.title,
        clientName: a.client?.name || 'Cliente sin nombre',
        requestedBy: a.requestedByUser?.name || 'Usuario no disponible',
        description: a.description,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        decisionNotes: a.decisionNotes,
        dueAt: a.dueAt?.toISOString(),
        versionUrl: buildVersionUrl(latestVersion?.driveFileId),
        versions: pieceVersions.map((version) => ({ id: version.id, number: version.versionNumber, fileName: version.fileName, url: buildVersionUrl(version.driveFileId), state: version.stateLabel, createdAt: version.createdAt.toISOString(), namingValid: version.namingValid })),
        decisionHistory,
      };
    });
  }
}
