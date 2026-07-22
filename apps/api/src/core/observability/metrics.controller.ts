import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../authorization/roles.guard';
import { Roles } from '../authorization/roles.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Métricas')
@Controller('metrics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Obtener métricas del sistema (solo admin)' })
  getMetrics() {
    return this.metrics.getMetrics();
  }
}
