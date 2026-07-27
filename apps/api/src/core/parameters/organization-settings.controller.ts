import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('settings')
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
export class OrganizationSettingsController {
  constructor(private readonly settings: OrganizationSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración efectiva de la organización' })
  list(@Req() request: AuthenticatedRequest) {
    return this.settings.list(request.organizationId || request.user.organizationId);
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar y auditar configuración de la organización' })
  update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateOrganizationSettingsDto) {
    return this.settings.update(
      request.organizationId || request.user.organizationId,
      request.user.id,
      dto.values,
    );
  }
}
