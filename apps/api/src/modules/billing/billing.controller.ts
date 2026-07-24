import { Controller, Get, Post, Put, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CreateInvoiceUseCase } from './use-cases/create-invoice.use-case';
import { ListInvoicesUseCase } from './use-cases/list-invoices.use-case';
import { ListChargeNotesUseCase } from './use-cases/list-charge-notes.use-case';
import { PriceChargeNoteUseCase } from './use-cases/price-charge-note.use-case';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { PriceChargeNoteDto } from './dto/price-charge-note.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Facturación')
@Controller('billing/invoices')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
export class BillingController {
  constructor(
    private createInvoice: CreateInvoiceUseCase,
    private listInvoices: ListInvoicesUseCase,
    private listChargeNotes: ListChargeNotesUseCase,
    private priceChargeNote: PriceChargeNoteUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear factura' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  create(@Body() dto: CreateInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.createInvoice.execute(dto, req.organizationId, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar facturas' })
  list(@Query() pagination: PaginationDto, @Req() req: AuthenticatedRequest) {
    return this.listInvoices.execute(req.organizationId, pagination.limit, pagination.offset);
  }

  @Get('charge-notes')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  chargeNotes(@Req() req: AuthenticatedRequest) {
    return this.listChargeNotes.execute(req.organizationId!);
  }

  @Put('charge-notes/:id/price')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  priceNote(@Param('id') id: string, @Body() body: PriceChargeNoteDto, @Req() req: AuthenticatedRequest) {
    return this.priceChargeNote.execute(id, req.organizationId, body.amount);
  }
}
