import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BriefsService } from './briefs.service';
import { CreateBriefDto } from './dto/create-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@ApiTags('Briefs')
@Controller('briefs')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
export class BriefsController {
  constructor(private service: BriefsService) {}

  @Post()
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo brief' })
  create(@Body() dto: CreateBriefDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar briefs' })
  findAll(@Query() query: PaginationDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.organizationId, query.limit, query.offset);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un brief por ID' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar un brief' })
  update(@Param('id') id: string, @Body() dto: UpdateBriefDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar un brief' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
