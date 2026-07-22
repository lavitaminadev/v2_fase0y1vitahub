import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetOperationsOverviewUseCase } from './get-operations-overview.use-case';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';

@ApiTags('Operaciones')
@Controller('operations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OperationsController {
  constructor(
    private overview: GetOperationsOverviewUseCase,
  ) {}

  @Get('overview')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD,
    UserRole.COMMUNITY_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener vista general de operaciones' })
  getOverview(@Req() req: AuthenticatedRequest) {
    return this.overview.execute(req.organizationId);
  }
}
