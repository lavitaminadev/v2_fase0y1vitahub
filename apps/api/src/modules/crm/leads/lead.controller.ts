import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLeadUseCase } from './use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './use-cases/list-leads.use-case';
import { ConvertLeadUseCase } from './use-cases/convert-lead.use-case';
import { UpdateLeadUseCase } from './use-cases/update-lead.use-case';
import { GetLeadUseCase } from './use-cases/get-lead.use-case';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Reservation } from '../../reservations/domain/reservation.entity';
import { Lead } from './lead.entity';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';

@ApiTags('CRM - Leads')
@Controller('crm/leads')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
@ModuleScope('crm')
export class LeadController {
  constructor(
    private createLead: CreateLeadUseCase,
    private listLeads: ListLeadsUseCase,
    private getLead: GetLeadUseCase,
    private convertLead: ConvertLeadUseCase,
    private updateLead: UpdateLeadUseCase,
    @InjectRepository(Reservation) private readonly reservationRepository: Repository<Reservation>,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo lead' })
  create(@Body() dto: CreateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.createLead.execute({ ...dto, organizationId: req.organizationId });
  }

  /**
   * Lista los leads visibles para el usuario.
   *
   * El resultado queda acotado a las cuentas que el usuario tiene asignadas: un community
   * manager ve solo los contactos de sus clientes, mientras dirección y administración ven
   * toda la organización.
   */
  @Get()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Listar leads' })
  async list(@Query() query: ListLeadsQueryDto, @Req() req: AuthenticatedRequest) {
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listLeads.execute(req.organizationId, query.limit, query.offset, {
      status: query.status,
      fitStatus: query.fitStatus,
      source: query.source,
      domain: query.domain,
      clientId: query.clientId,
      allowedClientIds,
    });
  }

  /** Devuelve un lead, siempre que pertenezca a una cuenta accesible para el usuario. */
  @Get(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Obtener un lead' })
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const lead = await this.getLead.execute(id, req.organizationId);
    await this.assertLeadAccess(req, lead);
    return lead;
  }

  /** Actualiza estado, calidad o etiquetas de un lead de una cuenta accesible. */
  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Actualizar estado de un lead' })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: AuthenticatedRequest) {
    await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    return this.updateLead.execute(id, dto, req.organizationId);
  }

  /**
   * Verifica que el lead pertenezca a una cuenta accesible para el usuario.
   *
   * Los leads sin cliente asignado corresponden al pipeline comercial de la agencia y solo
   * los alcanzan los usuarios sin restricción de cuentas.
   *
   * @returns El mismo lead, ya validado, para poder encadenar la llamada.
   * @throws NotFoundException cuando el lead no existe o queda fuera del alcance.
   */
  private async assertLeadAccess(req: AuthenticatedRequest, lead: Lead | null): Promise<Lead> {
    if (!lead) throw new NotFoundException('Lead no encontrado');
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    if (allowedClientIds === undefined) return lead;
    if (!lead.clientId || !allowedClientIds.includes(lead.clientId)) {
      throw new NotFoundException('Lead no encontrado');
    }
    return lead;
  }

  /**
   * Reservas asociadas a un lead.
   *
   * El cruce se hace por correo o teléfono y se acota además al cliente del lead: una misma
   * persona puede haber reservado con varios clientes de la organización.
   */
  @Get(':id/reservations')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Historial de reservas de un lead' })
  async reservations(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const lead = await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    const conditions: string[] = [];
    const params: Record<string, string> = { organizationId: req.organizationId };
    if (lead.email) { conditions.push('r.guest_email = :email'); params.email = lead.email; }
    if (lead.phone) { conditions.push('r.guest_phone = :phone'); params.phone = lead.phone; }
    if (conditions.length === 0) return [];
    const query = this.reservationRepository.createQueryBuilder('r')
      .where('r.organization_id = :organizationId', params)
      .andWhere(`(${conditions.join(' OR ')})`);
    if (lead.clientId) query.andWhere('r.client_id = :clientId', { clientId: lead.clientId });
    return query
      .orderBy('r.starts_at', 'DESC')
      .take(50)
      .getMany();
  }

  @Post(':id/convert')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Convertir lead a cliente' })
  convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.convertLead.execute(id, req.organizationId);
  }
}
