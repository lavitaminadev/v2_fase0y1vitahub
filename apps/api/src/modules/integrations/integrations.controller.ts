import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CreateIntegrationUseCase } from './create-integration.use-case';
import { ListIntegrationsUseCase } from './list-integrations.use-case';
import { UpdateIntegrationUseCase } from './update-integration.use-case';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { IntegrationAccountsService } from './integration-accounts.service';
import { AssignIntegrationClientDto } from './dto/assign-integration-client.dto';

@ApiTags('Integraciones')
@Controller('integrations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private createIntegration: CreateIntegrationUseCase,
    private listIntegrations: ListIntegrationsUseCase,
    private updateIntegration: UpdateIntegrationUseCase,
    private accounts: IntegrationAccountsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear una nueva integración' })
  create(@Body() dto: CreateIntegrationDto, @Req() req: AuthenticatedRequest) {
    return this.createIntegration.execute({ ...dto, organizationId: req.organizationId, name: dto.name || dto.provider });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar integraciones' })
  list(@Query('provider') provider: string, @Req() req: AuthenticatedRequest) {
    return this.listIntegrations.execute(req.organizationId, provider);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar estado de una integración' })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto, @Req() req: AuthenticatedRequest) {
    return this.updateIntegration.execute(id, dto, req.organizationId);
  }

  @Put('accounts/:accountId/client')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Asignar un activo externo a un cliente' })
  assignClient(@Param('accountId') accountId: string, @Body() dto: AssignIntegrationClientDto, @Req() req: AuthenticatedRequest) {
    return this.accounts.assignClient(accountId, dto.clientId, req.organizationId!);
  }
}
