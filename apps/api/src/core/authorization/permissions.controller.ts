import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionResolverService } from './permission-resolver.service';
import { UserPermissionOverride } from './user-permission-override.entity';
import { UpsertPermissionOverrideDto } from './dto/upsert-permission-override.dto';
import { Roles } from './roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { User } from '../../modules/users/user.entity';
import { isOrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../../shared/types/request';

/**
 * Consulta y administración de permisos por módulo.
 */
@ApiTags('Permisos')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionResolverService,
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Permisos efectivos del usuario autenticado.
   *
   * El frontend construye el menú con esta respuesta, de modo que lo visible coincide
   * exactamente con lo que el backend autoriza.
   */
  @Get('me/permissions')
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'Permisos efectivos del usuario autenticado' })
  async mine(@Req() req: AuthenticatedRequest) {
    const permissions = await this.permissions.permissionsFor(req.organizationId, req.user.id, req.user.role as UserRole);
    return { permissions };
  }

  /**
   * Detalle de permisos de un usuario, indicando qué proviene del cargo y qué de una
   * excepción.
   */
  @Get('users/:id/permissions')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Detalle de permisos de un usuario' })
  async ofUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const user = await this.findUser(id, req.organizationId);
    return {
      userId: user.id,
      role: user.role,
      modules: await this.permissions.explain(req.organizationId, user.id, user.role as UserRole),
    };
  }

  /**
   * Crea o reemplaza la excepción de un usuario sobre un módulo.
   *
   * Usar `level: 'none'` deniega de forma explícita un módulo que el cargo sí concede.
   */
  @Put('users/:id/permissions/:module')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Definir una excepción de permiso' })
  async upsert(
    @Param('id') id: string,
    @Param('module') module: string,
    @Body() dto: UpsertPermissionOverrideDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!isOrganizationFeatureKey(module)) throw new BadRequestException(`Módulo desconocido: ${module}`);
    const user = await this.findUser(id, req.organizationId);
    const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
    const saved = await this.overrides.save({
      ...(existing ?? {}),
      organizationId: req.organizationId,
      userId: user.id,
      module,
      level: dto.level,
      reason: dto.reason ?? null,
      grantedBy: req.user.id,
    });
    this.permissions.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserPermissionOverride',
      entityId: saved.id,
      action: existing ? 'updated' : 'created',
      before: existing ? { level: existing.level, reason: existing.reason } : undefined,
      after: { module, level: dto.level, reason: dto.reason ?? null },
    });
    return saved;
  }

  /** Elimina la excepción y devuelve el módulo al nivel que define el cargo. */
  @Delete('users/:id/permissions/:module')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Quitar una excepción de permiso' })
  async remove(@Param('id') id: string, @Param('module') module: string, @Req() req: AuthenticatedRequest) {
    const user = await this.findUser(id, req.organizationId);
    const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
    if (!existing) throw new NotFoundException('No existe una excepción para ese módulo');
    await this.overrides.remove(existing);
    this.permissions.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserPermissionOverride',
      entityId: existing.id,
      action: 'deleted',
      before: { module, level: existing.level, reason: existing.reason },
    });
    return { removed: true, module };
  }

  /**
   * Busca un usuario dentro de la organización de quien consulta.
   *
   * @throws NotFoundException si el usuario no existe o pertenece a otra organización.
   */
  private async findUser(id: string, organizationId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
