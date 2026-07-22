import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContentGridUseCase } from './create-content-grid.use-case';
import { ListContentGridsUseCase } from './list-content-grids.use-case';
import { CreateGridDto } from './dto/create-grid.dto';
import { ContentItem } from './content-item.entity';
import { ContentGrid } from './content-grid.entity';
import { AddContentItemDto } from './dto/add-content-item.dto';
import { UpdateContentItemDto } from './dto/update-item.dto';
import { UpdateGridStatusDto } from './dto/update-grid-status.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Parrillas de Contenido')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ContentController {
  constructor(
    private createGrid: CreateContentGridUseCase,
    private listGrids: ListContentGridsUseCase,
    @InjectRepository(ContentItem) private itemRepo: Repository<ContentItem>,
    @InjectRepository(ContentGrid) private gridRepo: Repository<ContentGrid>,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post('content/grids')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear parrilla de contenido semanal' })
  async create(@Body() dto: CreateGridDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.createGrid.execute({
      ...dto,
      organizationId: req.organizationId,
      weekStart: new Date(dto.weekStart),
      weekEnd: new Date(dto.weekEnd),
    });
  }

  @Get('content/grids')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar parrillas de contenido' })
  async list(@Query('clientId') clientId: string, @Query('month') month: string, @Req() req: AuthenticatedRequest) {
    const effectiveClientId = req.user?.role === UserRole.CLIENT ? req.user.clientId : clientId;
    if (req.user?.role === UserRole.CLIENT && !effectiveClientId) throw new ForbiddenException('Client account is not associated');
    await this.accountAccess.assertClient(req.organizationId, req.user, effectiveClientId);
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listGrids.execute(req.organizationId, effectiveClientId, month, req.user?.role === UserRole.CLIENT, clientIds);
  }

  @Post('content/grids/:gridId/items')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Agregar una publicación a una parrilla' })
  async addItem(@Param('gridId') gridId: string, @Body() dto: AddContentItemDto, @Req() req: AuthenticatedRequest) {
    const grid = await this.gridRepo.findOne({ where: { id: gridId, organizationId: req.organizationId } });
    if (!grid) throw new NotFoundException('Content grid not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, grid.clientId);
    const item = this.itemRepo.create({
      ...dto,
      caption: dto.caption.trim(),
      contentGridId: grid.id,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });
    return this.itemRepo.save(item);
  }

  @Put('content/grids/:id/status')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar estado de una parrilla' })
  async updateGridStatus(@Param('id') id: string, @Body() dto: UpdateGridStatusDto, @Req() req: AuthenticatedRequest) {
    const grid = await this.gridRepo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!grid) throw new NotFoundException('Content grid not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, grid.clientId);
    grid.status = dto.status;
    const saved = await this.gridRepo.save(grid);
    const status = ({ draft: 'pending', submitted: 'in_review', rejected: 'correction', approved: 'completed', published: 'completed' } as Record<string, string>)[dto.status] ?? 'pending';
    const period = new Date(grid.weekStart);
    await this.gridRepo.manager.query('UPDATE account_cycles SET grid_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [status, req.organizationId, grid.clientId, period.getFullYear(), period.getMonth() + 1]);
    return saved;
  }

  @Put('content/items/:id')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar item de contenido' })
  async updateItem(@Param('id') id: string, @Body() dto: UpdateContentItemDto, @Req() req: AuthenticatedRequest) {
    const item = await this.itemRepo.findOne({ where: { id }, relations: ['contentGrid'] });
    if (!item || item.contentGrid.organizationId !== req.organizationId) {
      throw new NotFoundException('Content item not found');
    }
    await this.accountAccess.assertClient(req.organizationId, req.user, item.contentGrid.clientId);
    Object.assign(item, dto, { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : item.scheduledAt });
    return this.itemRepo.save(item);
  }

  @Delete('content/items/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar item de contenido' })
  async deleteItem(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const item = await this.itemRepo.findOne({ where: { id }, relations: ['contentGrid'] });
    if (!item || item.contentGrid.organizationId !== req.organizationId) {
      throw new NotFoundException('Content item not found');
    }
    return this.itemRepo.remove(item);
  }
}
