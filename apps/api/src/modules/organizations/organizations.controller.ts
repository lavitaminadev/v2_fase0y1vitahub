import { Controller, Get, Post, Put, Body, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListOrganizationsUseCase } from './list-organizations.use-case';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationFeaturesDto } from './dto/update-organization-features.dto';
import { Organization } from './organization.entity';
import { normalizeOrganizationFeatures } from './organization-features';
import { Roles } from '../../core/authorization/roles.decorator';
import { FeatureGuard } from '../../core/authorization/feature.guard';
import { AuditService } from '../../core/audit/audit.service';
import { UserRole } from './user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';

/**
 * Endpoints de administración de organizaciones.
 */
@ApiTags('Organizaciones')
@Controller('organizations')
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
@ModuleScope('settings')
export class OrganizationsController {
  constructor(
    private readonly createOrg: CreateOrganizationUseCase,
    private readonly listOrgs: ListOrganizationsUseCase,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    private readonly featureGuard: FeatureGuard,
    private readonly audit: AuditService,
  ) {}

  /**
   * Crea una nueva organización. Restringido a admins.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear una organización' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.createOrg.execute(dto);
  }

  /**
   * Lista la organización autenticada.
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar organizaciones' })
  list(@Req() req: AuthenticatedRequest) {
    return this.listOrgs.execute(req.organizationId || req.user.organizationId);
  }

  /**
   * Actualiza el perfil de la organización del usuario actual.
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

  /**
   * Modulos habilitados de la organizacion actual.
   */
  @Get('features')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Módulos habilitados de la organización' })
  async features(@Req() req: AuthenticatedRequest) {
    const organizationId = req.organizationId || req.user.organizationId;
    const organization = await this.organizations.findOne({ where: { id: organizationId }, select: ['id', 'features'] });
    return { features: normalizeOrganizationFeatures(organization?.features) };
  }

  /**
   * Enciende o apaga modulos. Es la palanca para activar una fase completa sin desplegar.
   *
   * Solo admin: habilitar un modulo cambia lo que ve toda la organizacion.
   */
  @Put('features')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Habilitar o deshabilitar módulos de la organización' })
  async updateFeatures(@Req() req: AuthenticatedRequest, @Body() dto: UpdateOrganizationFeaturesDto) {
    const organizationId = req.organizationId || req.user.organizationId;
    const unknownKeys = UpdateOrganizationFeaturesDto.validateKeys(dto.features as Record<string, unknown>);
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`Módulos desconocidos: ${unknownKeys.join(', ')}. Válidos: ${UpdateOrganizationFeaturesDto.allowedKeys.join(', ')}`);
    }
    const organization = await this.organizations.findOne({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organización no encontrada');
    const features = normalizeOrganizationFeatures({ ...organization.features, ...dto.features });
    await this.organizations.update(organizationId, { features });
    // El guard memoriza los módulos, por lo que el cambio debe invalidar su caché para
    // aplicarse de inmediato.
    this.featureGuard.invalidate(organizationId);
    await this.audit.log({
      organizationId,
      actorId: req.user?.id,
      entityType: 'Organization',
      entityId: organizationId,
      action: 'updated',
      before: { features: organization.features },
      after: { features },
    });
    return { features };
  }
}
