import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { ListInteractionsDto } from './dto/list-interactions.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@Controller('crm/interactions')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
export class InteractionsController {
  constructor(private service: InteractionsService) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateInteractionDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId, req.user.id);
  }

  @Get()
  findAll(@Query() query: ListInteractionsDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateInteractionDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
