import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { IntegrationsHealthService } from './integrations-health.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly integrationsHealth: IntegrationsHealthService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check general del sistema' })
  async check() {
    return this.health.check();
  }

  @Get('db')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Health check de base de datos' })
  async db() {
    return this.health.checkDb();
  }

  @Get('integrations')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Health check de integraciones' })
  async integrations() {
    return this.integrationsHealth.checkAll();
  }
}
