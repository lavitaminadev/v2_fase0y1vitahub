import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { AccountCyclesService } from './account-cycles.service';
import { UpdateAccountCycleDto } from './dto/update-account-cycle.dto';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@Controller('account-cycles')
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CREATIVE_DIRECTOR)
export class AccountCyclesController {
  constructor(
    private readonly service: AccountCyclesService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query('year') year?: string, @Query('month') month?: string) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.service.list(req.organizationId!, year ? Number(year) : undefined, month ? Number(month) : undefined, clientIds);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() patch: UpdateAccountCycleDto, @Req() req: AuthenticatedRequest) {
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.service.update(id, req.organizationId!, patch, clientIds);
  }
}
