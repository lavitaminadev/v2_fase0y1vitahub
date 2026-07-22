import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import type { AuthenticatedRequest } from '@shared/types/request';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { PriceChargeNoteDto } from './dto/price-charge-note.dto';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Facturación')
@Controller('billing/invoices')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
export class BillingController {
  constructor(
    @InjectRepository(Invoice) private repo: Repository<Invoice>,
    private readonly billing: BillingService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear factura' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  async create(@Body() dto: CreateInvoiceDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.repo.save(this.repo.create({ ...dto, organizationId: req.organizationId }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar facturas' })
  list(@Req() req: AuthenticatedRequest) {
    return this.repo.find({ where: { organizationId: req.organizationId }, order: { issuedAt: 'DESC' } });
  }

  @Get('charge-notes')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  listChargeNotes(@Req() req: AuthenticatedRequest) {
    return this.billing.listChargeNotes(req.organizationId!);
  }

  @Put('charge-notes/:id/price')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  priceChargeNote(@Param('id') id: string, @Body() body: PriceChargeNoteDto, @Req() req: AuthenticatedRequest) {
    return this.billing.priceChargeNote(id, req.organizationId, body.amount);
  }
}
