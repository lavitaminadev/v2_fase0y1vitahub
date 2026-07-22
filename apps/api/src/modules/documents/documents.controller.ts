import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { GoogleDriveService } from './google-drive.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Documentos')
@Controller('documents')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DocumentsController {
  constructor(
    private service: DocumentsService,
    private drive: GoogleDriveService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Crear un nuevo documento' })
  create(@Body() dto: CreateDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar documentos' })
  async findAll(@Query() query: PaginationDto, @Req() req: AuthenticatedRequest) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.service.findAll(req.organizationId!, query.limit, query.offset, clientIds);
  }

  @Post('drive/clients/:clientId/bootstrap')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Crear o verificar la estructura Drive de un cliente' })
  bootstrapDrive(@Param('clientId') clientId: string, @Req() req: AuthenticatedRequest) {
    return this.drive.bootstrapClient(req.organizationId!, clientId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR, UserRole.CLIENT)
  @ApiOperation({ summary: 'Obtener un documento por ID' })
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.service.findOne(id, req.organizationId!, clientIds);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Actualizar un documento' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar un documento' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
