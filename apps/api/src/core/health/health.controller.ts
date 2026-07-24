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
    // An uptime monitor that checks the HTTP status code (the common case)
    // never sees a failure if this always returns 200 — the body's "status"
    // field was previously the only signal, easy to miss without custom parsing.
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
