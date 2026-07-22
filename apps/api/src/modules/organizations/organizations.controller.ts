import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListOrganizationsUseCase } from './list-organizations.use-case';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from './user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';

/**
 * Organization management endpoints.
 */
@ApiTags('Organizaciones')
@Controller('organizations')
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
export class OrganizationsController {
  constructor(
    private readonly createOrg: CreateOrganizationUseCase,
    private readonly listOrgs: ListOrganizationsUseCase,
  ) {}

  /**
   * Creates a new organization. Restricted to admins.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear una organización' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.createOrg.execute(dto);
  }

  /**
   * Lists the authenticated organization.
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar organizaciones' })
  list(@Req() req: AuthenticatedRequest) {
    return this.listOrgs.execute(req.organizationId || req.user.organizationId);
  }

  /**
   * Updates the current user's organization profile.
   */
  @Put('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Actualizar perfil de la organización' })
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateOrganizationDto) {
    const organizationId = req.organizationId || req.user.organizationId;
    return this.createOrg.executeUpdate(organizationId, dto);
  }
}
