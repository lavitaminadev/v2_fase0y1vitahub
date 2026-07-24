import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
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
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.check();
    // Un monitor de uptime que revisa el código de estado HTTP (el caso común)
    // nunca ve una falla si esto siempre devuelve 200 — antes el campo "status"
    // del body era la única señal, fácil de pasar por alto sin parseo custom.
    res.status(result.status === 'ok' ? 200 : 503);
    return result;
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
