import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { PieceStatus } from './piece-status.enum';
import { validate, extractState } from './naming-validator';
import { UserRole } from '../organizations/user-role.enum';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

@Injectable()
export class SubmitVersionUseCase {
  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(PieceVersion) private versionRepo: Repository<PieceVersion>,
    private readonly parameters: ParameterResolver,
  ) {}

  async execute(
    pieceId: string,
    organizationId: string,
    data: { fileName: string; driveFileId?: string; userId: string; role: UserRole },
  ) {
    const piece = await this.pieceRepo.findOne({ where: { id: pieceId, organizationId }, relations: ['client'] });
    if (!piece) throw new NotFoundException('Pieza no encontrada');
    if ([UserRole.DESIGNER, UserRole.AUDIOVISUAL].includes(data.role) && piece.assignedTo !== data.userId) {
      throw new ForbiddenException('Solo el responsable asignado puede enviar una versión');
    }
    if (![PieceStatus.IN_PROGRESS, PieceStatus.CORRECTION].includes(piece.status)) {
      throw new BadRequestException('La pieza debe estar en progreso o corrección para enviar una versión');
    }

    const versions = await this.versionRepo.find({ where: { pieceId }, order: { versionNumber: 'DESC' }, take: 1 });
    const finalImmutable = await this.parameters.get('documents.final_immutable', piece.clientId, null, organizationId);
    if (versions[0]?.isFinal && finalImmutable !== false) {
      throw new BadRequestException('La última versión es FINAL e inmutable. Crea una nueva pieza para cambios posteriores');
    }
    const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;

    const clientCode = piece?.client?.name?.substring(0, 4).toUpperCase() || '';
    const namingResult = validate(data.fileName, clientCode);
    const state = extractState(data.fileName);

    const version = this.versionRepo.create({
      pieceId,
      versionNumber: nextVersion,
      fileName: data.fileName,
      driveFileId: data.driveFileId,
      createdBy: data.userId,
      namingValid: namingResult.isValid,
      namingErrors: namingResult.errors.length > 0 ? namingResult.errors : undefined,
      stateLabel: state ?? undefined,
      isFinal: state === 'FINAL',
    });

    piece.status = PieceStatus.INTERNAL_REVIEW;
    await this.pieceRepo.save(piece);
    return this.versionRepo.save(version);
  }
}
