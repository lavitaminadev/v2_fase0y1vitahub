import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './service.entity';
import { Pack } from './pack.entity';
import { ServiceStatus } from './service-status.enum';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreatePackDto } from './dto/create-pack.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';

@Controller('catalog')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
export class CatalogController {
  constructor(
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(Pack) private packRepo: Repository<Pack>,
    private readonly quotes: QuotesService,
  ) {}

  @Get('services')
  listServices(@Req() req: AuthenticatedRequest) {
    return this.serviceRepo.find({ where: { organizationId: req.organizationId, status: ServiceStatus.ACTIVE }, order: { name: 'ASC' } });
  }

  @Post('services')
  createService(@Body() dto: CreateServiceDto, @Req() req: AuthenticatedRequest) {
    return this.serviceRepo.save(this.serviceRepo.create({ ...dto, organizationId: req.organizationId, status: ServiceStatus.ACTIVE }));
  }

  @Put('services/:id')
  async updateService(@Param('id') id: string, @Body() dto: CreateServiceDto, @Req() req: AuthenticatedRequest) {
    const service = await this.serviceRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return this.serviceRepo.save(this.serviceRepo.merge(service, dto));
  }

  @Delete('services/:id')
  @Roles(UserRole.ADMIN)
  async deleteService(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const service = await this.serviceRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    service.status = ServiceStatus.ARCHIVED;
    return this.serviceRepo.save(service);
  }

  @Get('packs')
  listPacks(@Req() req: AuthenticatedRequest) {
    return this.packRepo.find({ where: { organizationId: req.organizationId }, order: { createdAt: 'DESC' } });
  }

  @Post('packs')
  createPack(@Body() dto: CreatePackDto, @Req() req: AuthenticatedRequest) {
    return this.packRepo.save(this.packRepo.create({ ...dto, organizationId: req.organizationId }));
  }

  @Put('packs/:id')
  async updatePack(@Param('id') id: string, @Body() dto: CreatePackDto, @Req() req: AuthenticatedRequest) {
    const pack = await this.packRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!pack) throw new NotFoundException('Pack no encontrado');
    return this.packRepo.save(this.packRepo.merge(pack, dto));
  }

  @Delete('packs/:id')
  @Roles(UserRole.ADMIN)
  async deletePack(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const pack = await this.packRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!pack) throw new NotFoundException('Pack no encontrado');
    await this.packRepo.remove(pack);
    return { deleted: true };
  }

  @Get('quotes')
  listQuotes(@Req() req: AuthenticatedRequest) { return this.quotes.list(req.organizationId); }

  @Post('quotes')
  createQuote(@Body() dto: CreateQuoteDto, @Req() req: AuthenticatedRequest) { return this.quotes.create(req.organizationId, req.user.id, dto); }

  @Put('quotes/:id')
  updateQuote(@Param('id') id: string, @Body() dto: UpdateQuoteDto, @Req() req: AuthenticatedRequest) { return this.quotes.update(id, req.organizationId, dto); }

  @Post('quotes/:id/version')
  createQuoteVersion(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.quotes.createVersion(id, req.organizationId, req.user.id); }

  @Post('quotes/:id/send')
  sendQuote(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.quotes.send(id, req.organizationId); }

  @Post('quotes/:id/accept')
  acceptQuote(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.quotes.accept(id, req.organizationId, req.user.id); }
}
