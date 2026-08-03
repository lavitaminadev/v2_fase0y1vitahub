import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { ListInteractionsDto } from './dto/list-interactions.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { RequiresFeature } from '../../../core/authorization/requires-feature.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';

@Controller('crm/interactions')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
@RequiresFeature('commercialPipeline')
export class InteractionsController {
  constructor(
    private service: InteractionsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateInteractionDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId, req.user.id);
  }

  @Get()
  async findAll(@Query() query: ListInteractionsDto, @Req() req: AuthenticatedRequest) {
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const clientScope = allowedClientIds === undefined
      ? query.clientId
      : (query.clientId ? (allowedClientIds.includes(query.clientId) ? query.clientId : '__none__') : undefined);
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId, clientScope);
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
