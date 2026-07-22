import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@shared/types/request';
import type { Response } from 'express';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { ReservationsService } from './application/reservations.service';
import { CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ListReservationsDto, ReservationScopeDto, UpdateReservationDto, UpdateReservationFormDto } from './dto/reservation.dto';

@ApiTags('Reservas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly service: ReservationsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  private publicOrigin(): string | undefined {
    return (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '') || undefined;
  }

  private async decorateForm(organizationId: string, clientId: string, form: any) {
    const context = await this.service.formContext(organizationId, clientId);
    const publicOrigin = this.publicOrigin();
    return { ...form, ...context, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined };
  }

  private client(req: AuthenticatedRequest): string | undefined {
    if (req.user.role !== UserRole.CLIENT) return undefined;
    if (!req.user.clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');
    return req.user.clientId;
  }

  private async scope(req: AuthenticatedRequest) {
    return {
      clientId: this.client(req),
      clientIds: await this.accountAccess.allowedClientIds(req.organizationId, req.user),
    };
  }

  private async requestedScope(req: AuthenticatedRequest, requestedClientId?: string) {
    const scope = await this.scope(req);
    if (!requestedClientId) return scope;
    await this.accountAccess.assertClient(req.organizationId, req.user, requestedClientId);
    return { clientId: requestedClientId, clientIds: undefined };
  }

  @Get('forms')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async forms(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    const forms = await this.service.listForms(req.organizationId, scope.clientId, scope.clientIds);
    const publicOrigin = this.publicOrigin();
    return forms.map((form) => ({ ...form, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined }));
  }

  @Post('forms')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReservationFormDto) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    const form = await this.service.createForm(req.organizationId, req.user.id, dto);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Get('forms/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async form(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    const form = await this.service.getForm(req.organizationId, id, scope.clientId, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Patch('forms/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReservationFormDto) {
    const scope = await this.scope(req);
    if (req.user.role === UserRole.CLIENT) {
      const allowed: UpdateReservationFormDto = {
        timezone: dto.timezone,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes,
        capacityPerSlot: dto.capacityPerSlot,
        dailyCapacity: dto.dailyCapacity,
        minimumNoticeHours: dto.minimumNoticeHours,
        maximumAdvanceDays: dto.maximumAdvanceDays,
        confirmationMode: dto.confirmationMode,
        scheduleConfig: dto.scheduleConfig,
        teamNotifications: dto.teamNotifications,
      };
      const form = await this.service.updateForm(req.organizationId, id, allowed, scope.clientId, scope.clientIds);
      return this.decorateForm(req.organizationId, form.clientId, form);
    }
    const form = await this.service.updateForm(req.organizationId, id, dto, scope.clientId, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Post('forms/:id/duplicate')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async duplicate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    const form = await this.service.duplicateForm(req.organizationId, id, req.user.id, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Get('forms/:id/blocks')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async blocks(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.listBlocks(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  @Post('forms/:id/blocks')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async block(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateBlockDto) {
    const scope = await this.scope(req);
    return this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds);
  }

  @Post('forms/:id/blocks/batch')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async batchBlock(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dtos: CreateBlockDto[]) {
    const scope = await this.scope(req);
    const results = await Promise.all(dtos.map((dto) => this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds).catch(() => null)));
    return { created: results.filter(Boolean).length };
  }

  @Delete('blocks/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async deleteBlock(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.removeBlock(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  @Post('manual')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async createManual(@Req() req: AuthenticatedRequest, @Body() dto: CreateManualReservationDto) {
    const scope = await this.scope(req);
    return this.service.createManual(req.organizationId, req.user.id, dto, scope.clientId, scope.clientIds);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListReservationsDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.listReservations(req.organizationId, query, scope.clientId, scope.clientIds, req.user.role !== UserRole.CLIENT);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async updateReservation(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReservationDto) {
    const scope = await this.scope(req);
    if (req.user.role === UserRole.CLIENT && (dto.internalNotes !== undefined || dto.status && dto.status !== 'cancelled_client')) {
      throw new ForbiddenException('El portal cliente solo permite reagendar o cancelar una reserva');
    }
    return this.service.updateReservation(
      req.organizationId,
      id,
      dto,
      req.user.id,
      req.user.role === UserRole.CLIENT ? 'client' : 'team',
      scope.clientId,
      scope.clientIds,
    );
  }

  @Get(':id/history')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async history(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.history(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  @Get('coupons')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async listCoupons(@Req() req: AuthenticatedRequest) {
    const scope = await this.scope(req);
    return this.service.listCoupons(req.organizationId, scope.clientId);
  }

  @Post('coupons')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async createCoupon(@Req() req: AuthenticatedRequest, @Body() dto: CreateCouponDto) {
    return this.service.createCoupon(req.organizationId, req.user.id, dto, this.client(req));
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async exportCsv(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto, @Res() res: Response) {
    const scope = await this.requestedScope(req, query.clientId);
    const csv = await this.service.exportCsv(req.organizationId, scope.clientId, scope.clientIds);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reservas.csv"');
    res.send(`\uFEFF${csv}`);
  }

  @Get('analytics/metrics')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async metrics(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.metrics(req.organizationId, scope.clientId, scope.clientIds);
  }
}
