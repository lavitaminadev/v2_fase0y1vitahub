import { BadRequestException, Controller, ForbiddenException, Get, Post, Put, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListApprovalsUseCase } from './list-approvals.use-case';
import { UpdateApprovalStatusUseCase } from './update-approval-status.use-case';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalRequestStatus } from './approval-request-status.enum';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { Client } from '../clients/client.entity';
import { Piece } from '../production/piece.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Aprobaciones')
@Controller('approvals')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ApprovalsController {
  constructor(
    private listApprovals: ListApprovalsUseCase,
    private updateStatus: UpdateApprovalStatusUseCase,
    @InjectRepository(ApprovalRequest) private repo: Repository<ApprovalRequest>,
    @InjectRepository(Client) private clients: Repository<Client>,
    @InjectRepository(Piece) private pieces: Repository<Piece>,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear solicitud de aprobación' })
  async create(@Body() dto: CreateApprovalDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId: req.organizationId } });
    const piece = await this.pieces.findOne({ where: { id: dto.entityId, clientId: dto.clientId, organizationId: req.organizationId } });
    if (!client || !piece) throw new BadRequestException('La pieza y el cliente deben pertenecer a esta organización');
    return this.repo.save(this.repo.create({
      ...dto,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      organizationId: req.organizationId,
      requestedBy: req.user.id,
      status: ApprovalRequestStatus.PENDING,
    }));
  }

  @Get()
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar solicitudes de aprobación' })
  async list(@Req() req: AuthenticatedRequest) {
    const clientId = req.user?.role === 'client' ? req.user.clientId : undefined;
    if (req.user?.role === UserRole.CLIENT && !clientId) throw new ForbiddenException('Client account is not associated');
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listApprovals.execute(req.organizationId, clientId, clientIds);
  }

  @Put(':id')
  @Roles(UserRole.ART_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud' })
  async update(@Param('id') id: string, @Body() dto: UpdateApprovalDto, @Req() req: AuthenticatedRequest) {
    const approval = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!approval) throw new BadRequestException('Approval request not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, approval.clientId);
    return this.updateStatus.execute(
      id,
      req.organizationId,
      { userId: req.user.id, role: req.user.role as UserRole, clientId: req.user.clientId },
      dto.status,
      dto.decisionNotes,
    );
  }
}
