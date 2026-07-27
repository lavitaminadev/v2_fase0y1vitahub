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

  /**
   * Sonda de disponibilidad para monitores externos.
   *
   * Responde 200 cuando el sistema está operativo y 503 cuando no, de modo que un monitor
   * de uptime pueda decidir por el código HTTP sin interpretar el cuerpo.
   *
   * El cuerpo se limita al estado agregado: al ser un endpoint sin autenticación, no
   * expone memoria, disco ni detalle de dependencias. Ese detalle vive en `/health/details`.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Sonda de disponibilidad pública' })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? 200 : 503);
    return { status: result.status, timestamp: result.timestamp, version: result.version };
  }

  /**
   * Diagnóstico completo: base de datos, memoria, disco y dependencias externas.
   *
   * Responde igual que la sonda pública en cuanto al código HTTP, con el detalle que la
   * administración necesita para diagnosticar.
   */
  @Get('details')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Diagnóstico detallado del sistema' })
  async details(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.check();
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
