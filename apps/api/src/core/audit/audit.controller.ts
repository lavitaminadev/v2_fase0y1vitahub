import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../authorization/roles.decorator';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('entityType') entityType?: string, @Query('action') action?: string, @Query('actorId') actorId?: string, @Query('limit') limit?: string) {
    return this.audit.search(req.organizationId!, { entityType, action, actorId, limit: limit ? Number(limit) : undefined });
  }
}
