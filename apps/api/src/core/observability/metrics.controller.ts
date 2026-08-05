import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../authorization/roles.guard';
import { Roles } from '../authorization/roles.decorator';
import { MetricsService } from './metrics.service';
import { ModuleExempt } from '../authorization/module-scope.decorator';

@ApiTags('Métricas')
@Controller('metrics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
@ModuleExempt('Sonda de operacion consumida por el monitoreo, no por la aplicacion')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Obtener métricas del sistema (solo admin)' })
  getMetrics() {
    return this.metrics.getMetrics();
  }
}
