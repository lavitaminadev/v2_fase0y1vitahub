import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateOpportunityUseCase } from './use-cases/create-opportunity.use-case';
import { ListOpportunitiesUseCase } from './use-cases/list-opportunities.use-case';
import { GetOpportunityUseCase } from './use-cases/get-opportunity.use-case';
import { UpdateOpportunityUseCase } from './use-cases/update-opportunity.use-case';
import { RemoveOpportunityUseCase } from './use-cases/remove-opportunity.use-case';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@Controller('crm/opportunities')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
export class OpportunitiesController {
  constructor(
    private createOpportunity: CreateOpportunityUseCase,
    private listOpportunities: ListOpportunitiesUseCase,
    private getOpportunity: GetOpportunityUseCase,
    private updateOpportunity: UpdateOpportunityUseCase,
    private removeOpportunity: RemoveOpportunityUseCase,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.createOpportunity.execute(dto, req.organizationId);
  }

  @Get()
  findAll(@Query() query: ListOpportunitiesDto, @Req() req: AuthenticatedRequest) {
    return this.listOpportunities.execute(req.organizationId, query.limit, query.offset, query.leadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.getOpportunity.execute(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.updateOpportunity.execute(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.removeOpportunity.execute(id, req.organizationId);
  }
}
