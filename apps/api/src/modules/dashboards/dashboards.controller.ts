import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardsService } from './dashboards.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DashboardsController {
  constructor(private service: DashboardsService) {}

  @Get('overview')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD,
  )
  @ApiOperation({ summary: 'Dashboard general de la organizacion' })
  overview(@Req() req: AuthenticatedRequest) {
    return this.service.getOverview(req.organizationId);
  }

  @Get('production')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD,
  )
  @ApiOperation({ summary: 'Dashboard de produccion' })
  production(@Req() req: AuthenticatedRequest) {
    return this.service.getProduction(req.organizationId);
  }

  @Get('financial')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
  )
  @ApiOperation({ summary: 'Dashboard financiero' })
  financial(@Req() req: AuthenticatedRequest) {
    return this.service.getFinancial(req.organizationId);
  }
}
