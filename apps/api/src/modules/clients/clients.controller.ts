import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import { ClientOverviewService } from './client-overview.service';
import { PaginationDto } from '../../shared/dto/pagination.dto';

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
    private readonly overviewService: ClientOverviewService,
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
  async list(@Query() pagination: PaginationDto, @Req() req: AuthenticatedRequest) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listClients.execute(req.organizationId, clientIds, pagination.limit, pagination.offset);
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
    return this.overviewService.getOverview(id, req.organizationId);
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
