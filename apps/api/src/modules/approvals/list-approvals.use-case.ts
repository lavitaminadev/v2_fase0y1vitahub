import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { PieceVersion } from '../production/piece-version.entity';

function buildVersionUrl(driveFileId?: string): string | undefined {
  if (!driveFileId) return undefined;
  return `https://drive.google.com/file/d/${driveFileId}/view`;
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
    });
    const pieceIds = [...new Set(approvals.filter((approval) => approval.entityType === 'piece').map((approval) => approval.entityId))];
    const versions = pieceIds.length ? await this.versionRepo.find({ where: { pieceId: In(pieceIds) }, order: { versionNumber: 'DESC' } }) : [];
    return approvals.map((a) => {
      const pieceVersions = versions.filter((version) => version.pieceId === a.entityId);
      const latestVersion = pieceVersions[0];
      const decisionHistory = approvals.filter((related) => related.entityId === a.entityId).map((related) => ({ id: related.id, status: related.status, notes: related.decisionNotes, requestedAt: related.createdAt.toISOString(), decidedAt: related.decisionAt?.toISOString(), requestedBy: related.requestedByUser?.name || 'Usuario no disponible' }));

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
