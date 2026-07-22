import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OpportunitiesService } from './opportunities.service';
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
  constructor(private service: OpportunitiesService) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId);
  }

  @Get()
  findAll(@Query() query: ListOpportunitiesDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
