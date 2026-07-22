import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateClientUseCase } from './create-client.use-case';
import { ListClientsUseCase } from './list-clients.use-case';
import { GetClientUseCase } from './get-client.use-case';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { UpdateClientDto } from './dto/update-client.dto';
import { User } from '../users/user.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Clientes')
@Controller('clients')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
export class ClientsController {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectRepository(User) private users: Repository<User>,
    private readonly accountAccess: AccountAccessService,
    private readonly dataSource: DataSource,
    private createClient: CreateClientUseCase,
    private listClients: ListClientsUseCase,
    private getClient: GetClientUseCase,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo cliente' })
  create(@Body() dto: CreateClientDto, @Req() req: AuthenticatedRequest) {
    return this.createClient.execute({ ...dto, organizationId: req.organizationId });
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes de la organizacion' })
  async list(@Req() req: AuthenticatedRequest) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listClients.execute(req.organizationId, clientIds);
  }

  @Get('options/managers')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar responsables disponibles para cuentas' })
  managerOptions(@Req() req: AuthenticatedRequest) {
    return this.users.find({
      select: { id: true, name: true, role: true },
      where: {
        organizationId: req.organizationId,
        isActive: true,
        role: In([UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR]),
      },
      order: { name: 'ASC' },
    });
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Obtener vista operativa 360 de un cliente' })
  async overview(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, id);
    const client = await this.getClient.execute(id, req.organizationId);
    const params = [req.organizationId, id];
    const [
      pieceStatuses,
      [content],
      [meetings],
      [documents],
      [forms],
      [contracts],
      [briefs],
      [ud],
      recentPieces,
      recentMeetings,
    ] = await Promise.all([
      this.dataSource.query('SELECT status, COUNT(*) AS total FROM pieces WHERE organization_id = ? AND client_id = ? GROUP BY status', params),
      this.dataSource.query('SELECT COUNT(*) AS total FROM content_grids WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COUNT(*) AS total, SUM(CASE WHEN scheduled_at >= NOW() THEN 1 ELSE 0 END) AS upcoming FROM meetings WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COUNT(*) AS total FROM documents WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COUNT(*) AS total, SUM(CASE WHEN status = \'published\' THEN 1 ELSE 0 END) AS published FROM reservation_forms WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COUNT(*) AS total, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) AS active FROM contracts WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COUNT(*) AS total, SUM(CASE WHEN status = \'approved\' THEN 1 ELSE 0 END) AS approved FROM briefs WHERE organization_id = ? AND client_id = ?', params),
      this.dataSource.query('SELECT COALESCE(SUM(contracted), 0) AS contracted, COALESCE(SUM(reserved), 0) AS reserved, COALESCE(SUM(consumed), 0) AS consumed FROM ud_budgets WHERE client_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())', [id]),
      this.dataSource.query('SELECT id, title, status, deadline_at AS deadlineAt, ud_amount AS udAmount FROM pieces WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC LIMIT 5', params),
      this.dataSource.query('SELECT id, title, type, status, scheduled_at AS scheduledAt FROM meetings WHERE organization_id = ? AND client_id = ? ORDER BY scheduled_at DESC LIMIT 5', params),
    ]);
    const pendingPieces = pieceStatuses.reduce((sum: number, row: { status: string; total: string | number }) =>
      ['delivered', 'cancelled'].includes(row.status) ? sum : sum + Number(row.total), 0);

    return {
      client,
      stats: {
        pendingPieces,
        contentGrids: Number(content?.total ?? 0),
        meetings: Number(meetings?.total ?? 0),
        upcomingMeetings: Number(meetings?.upcoming ?? 0),
        documents: Number(documents?.total ?? 0),
        reservationForms: Number(forms?.total ?? 0),
        publishedForms: Number(forms?.published ?? 0),
        contracts: Number(contracts?.total ?? 0),
        activeContracts: Number(contracts?.active ?? 0),
        briefs: Number(briefs?.total ?? 0),
        approvedBriefs: Number(briefs?.approved ?? 0),
      },
      ud: {
        contracted: Number(ud?.contracted ?? 0),
        reserved: Number(ud?.reserved ?? 0),
        consumed: Number(ud?.consumed ?? 0),
      },
      pieceStatuses: pieceStatuses.map((row: { status: string; total: string | number }) => ({ status: row.status, total: Number(row.total) })),
      recentPieces,
      recentMeetings,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un cliente' })
  async getOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, id);
    return this.getClient.execute(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar un cliente' })
  async update(@Param('id') id: string, @Body() dto: UpdateClientDto, @Req() req: AuthenticatedRequest) {
    const client = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    if (dto.communityManagerId) {
      const manager = await this.users.findOne({ where: { id: dto.communityManagerId, organizationId: req.organizationId, isActive: true } });
      if (!manager || !['community_manager', 'operations_director'].includes(manager.role)) {
        throw new BadRequestException('El responsable debe ser una CM o dirección de operaciones activa');
      }
    }
    Object.assign(client, dto, {
      startedAt: dto.startedAt ? new Date(dto.startedAt) : client.startedAt,
      renewalAt: dto.renewalAt ? new Date(dto.renewalAt) : client.renewalAt,
    });
    return this.repo.save(client);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar un cliente' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const client = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.repo.remove(client);
  }
}
