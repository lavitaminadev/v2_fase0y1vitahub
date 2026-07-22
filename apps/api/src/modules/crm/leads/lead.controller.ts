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
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Reservation } from '../../reservations/domain/reservation.entity';

@ApiTags('CRM - Leads')
@Controller('crm/leads')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
export class LeadController {
  constructor(
    private createLead: CreateLeadUseCase,
    private listLeads: ListLeadsUseCase,
    private getLead: GetLeadUseCase,
    private convertLead: ConvertLeadUseCase,
    private updateLead: UpdateLeadUseCase,
    @InjectRepository(Reservation) private readonly reservationRepository: Repository<Reservation>,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo lead' })
  create(@Body() dto: CreateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.createLead.execute({ ...dto, organizationId: req.organizationId });
  }

  @Get()
  @ApiOperation({ summary: 'Listar leads' })
  list(@Query('status') status: string, @Query('fitStatus') fitStatus: string, @Query('source') source: string, @Query('clientId') clientId: string, @Req() req: AuthenticatedRequest) {
    return this.listLeads.execute(req.organizationId, status, fitStatus, source, clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un lead' })
  getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.getLead.execute(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar estado de un lead' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.updateLead.execute(id, dto, req.organizationId);
  }

  @Get(':id/reservations')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Historial de reservas de un lead' })
  async reservations(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const lead = await this.getLead.execute(id, req.organizationId);
    if (!lead) throw new NotFoundException('Lead no encontrado');
    if (!lead.email && !lead.phone) return [];
    const qb = this.reservationRepository.createQueryBuilder('r')
      .where('r.organization_id = :organizationId', { organizationId: req.organizationId })
      .andWhere('(r.guest_email = :email OR r.guest_phone = :phone)', { email: lead.email || '', phone: lead.phone || '' })
      .orderBy('r.starts_at', 'DESC')
      .take(50);
    return qb.getMany();
  }

  @Post(':id/convert')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Convertir lead a cliente' })
  convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.convertLead.execute(id, req.organizationId);
  }
}
