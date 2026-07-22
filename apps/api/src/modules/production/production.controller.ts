import { BadRequestException, Controller, Get, Post, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssignPieceUseCase } from './assign-piece.use-case';
import { SubmitVersionUseCase } from './submit-version.use-case';
import { RejectPieceUseCase } from './reject-piece.use-case';
import { DeliverPieceUseCase } from './deliver-piece.use-case';
import { ListPiecesUseCase } from './list-pieces.use-case';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { AssignPieceDto } from './dto/assign-piece.dto';
import { SubmitVersionDto } from './dto/submit-version.dto';
import { RejectPieceDto } from './dto/reject-piece.dto';
import { CreatePieceDto } from './dto/create-piece.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ApprovalRequest } from '../approvals/approval-request.entity';
import { ApprovalRequestStatus } from '../approvals/approval-request-status.enum';
import { PieceVersion } from './piece-version.entity';
import { calculatePieceUd } from '../design-budget/ud-calculator';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

@ApiTags('Produccion')
@Controller('production/pieces')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
export class ProductionController {
  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(ApprovalRequest) private approvalRepo: Repository<ApprovalRequest>,
    @InjectRepository(PieceVersion) private versionRepo: Repository<PieceVersion>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly accountAccess: AccountAccessService,
    private readonly parameters: ParameterResolver,
    private assignPiece: AssignPieceUseCase,
    private submitVer: SubmitVersionUseCase,
    private rejectPiece: RejectPieceUseCase,
    private deliverPiece: DeliverPieceUseCase,
    private listPieces: ListPiecesUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear una nueva pieza' })
  async create(@Body() dto: CreatePieceDto, @Req() req: AuthenticatedRequest) {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId, organizationId: req.organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    if (dto.dependencyIds?.length) {
      const dependencyCount = await this.pieceRepo.count({ where: { id: In(dto.dependencyIds), organizationId: req.organizationId } });
      if (dependencyCount !== new Set(dto.dependencyIds).size) throw new BadRequestException('Una o más dependencias no pertenecen a esta organización');
    }
    const { carouselSlides, deadlineAt, ...pieceData } = dto;
    const piece = this.pieceRepo.create({
      ...pieceData,
      organizationId: req.organizationId,
      status: PieceStatus.BACKLOG,
      title: dto.title.trim(),
      deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
      udAmount: calculatePieceUd(dto.type, carouselSlides),
    });
    return this.pieceRepo.save(piece);
  }

  @Get()
  @ApiOperation({ summary: 'Listar piezas de produccion' })
  async list(@Query('status') status: PieceStatus, @Query('clientId') clientId: string, @Query('assignedTo') assignedTo: string, @Req() req: AuthenticatedRequest) {
    const effectiveAssignee = [UserRole.DESIGNER, UserRole.AUDIOVISUAL].includes(req.user.role as UserRole)
      ? req.user.id
      : assignedTo;
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listPieces.execute(req.organizationId, status, clientId, effectiveAssignee, clientIds);
  }

  @Get('options/assignees')
  @Roles(UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar responsables creativos activos' })
  assigneeOptions(@Req() req: AuthenticatedRequest) {
    return this.userRepo.find({
      select: { id: true, name: true, role: true, weeklyCapacityUd: true },
      where: {
        organizationId: req.organizationId,
        isActive: true,
        role: In([UserRole.DESIGNER, UserRole.AUDIOVISUAL, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR]),
      },
      order: { name: 'ASC' },
    });
  }

  @Post(':id/assign')
  @Roles(UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Asignar responsable a una pieza' })
  assign(@Param('id') id: string, @Body() dto: AssignPieceDto, @Req() req: AuthenticatedRequest) {
    return this.assignPiece.execute(id, dto.designerId, req.organizationId, req.user.id);
  }

  @Post(':id/versions')
  @Roles(UserRole.DESIGNER, UserRole.AUDIOVISUAL, UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Subir nueva version de una pieza' })
  submitVersion(@Param('id') id: string, @Body() dto: SubmitVersionDto, @Req() req: AuthenticatedRequest) {
    return this.submitVer.execute(id, req.organizationId, { ...dto, userId: req.user.id, role: req.user.role as UserRole });
  }

  @Post(':id/reject')
  @Roles(UserRole.ART_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Rechazar pieza y solicitar correccion' })
  async reject(@Param('id') id: string, @Body() dto: RejectPieceDto, @Req() req: AuthenticatedRequest) {
    const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!piece) throw new NotFoundException('Piece not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, piece.clientId);
    return this.rejectPiece.execute(id, req.organizationId, {
      ...dto,
      userId: req.user.id,
      role: req.user.role as UserRole,
      clientId: req.user.clientId,
    });
  }

  @Post(':id/deliver')
  @Roles(UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Entregar pieza al cliente' })
  deliver(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.deliverPiece.execute(id, req.organizationId, req.user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ART_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar pieza internamente' })
  async approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!piece) throw new NotFoundException('Piece not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, piece.clientId);
    if (piece.status !== PieceStatus.CLIENT_VALIDATION) throw new BadRequestException('La pieza no está pendiente de aprobación');
    piece.status = PieceStatus.APPROVED;
    return this.pieceRepo.save(piece);
  }

  @Post(':id/start')
  @Roles(UserRole.DESIGNER, UserRole.AUDIOVISUAL, UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Iniciar progreso de una pieza' })
  async startProgress(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!piece) throw new NotFoundException('Piece not found');
    if (![PieceStatus.ASSIGNED, PieceStatus.CORRECTION].includes(piece.status)) {
      throw new BadRequestException('La pieza debe estar asignada o en corrección para iniciar el trabajo');
    }
    piece.status = PieceStatus.IN_PROGRESS;
    piece.startedAt = piece.startedAt ?? new Date();
    return this.pieceRepo.save(piece);
  }

  @Post(':id/send-to-client')
  @Roles(UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enviar pieza a validacion del cliente' })
  async sendToClient(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId }, relations: ['client'] });
    if (!piece) throw new NotFoundException('Piece not found');

    if (piece.status !== PieceStatus.INTERNAL_REVIEW) throw new BadRequestException('La pieza debe estar en revisión interna');

    const latestVersion = await this.versionRepo.findOne({
      where: { pieceId: piece.id },
      order: { versionNumber: 'DESC' },
    });
    if (!latestVersion) throw new BadRequestException('Debes cargar una versión antes de enviarla al cliente');

    const validationMonths = Number(await this.parameters.get('production.client_validation_months', piece.clientId, null, req.organizationId) ?? 3);
    const clientStartedAt = piece.client?.createdAt ? new Date(piece.client.createdAt) : new Date();
    const automaticApprovalAt = new Date(clientStartedAt);
    automaticApprovalAt.setMonth(automaticApprovalAt.getMonth() + validationMonths);
    if (validationMonths === 0 || automaticApprovalAt <= new Date()) {
      piece.status = PieceStatus.APPROVED;
      return this.pieceRepo.save(piece);
    }

    piece.status = PieceStatus.CLIENT_VALIDATION;
    await this.pieceRepo.save(piece);

    const existingPending = await this.approvalRepo.findOne({
      where: {
        organizationId: req.organizationId,
        entityType: 'piece',
        entityId: piece.id,
        status: ApprovalRequestStatus.PENDING,
      },
    });

    if (!existingPending) {
      await this.approvalRepo.save(this.approvalRepo.create({
        organizationId: req.organizationId,
        clientId: piece.clientId,
        title: piece.title,
        description: piece.client?.name,
        entityType: 'piece',
        entityId: piece.id,
        requestedBy: req.user.id,
        dueAt: piece.deadlineAt,
      }));
    }

    return piece;
  }
}
