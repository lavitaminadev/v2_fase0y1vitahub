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
import { ModuleScope } from '../authorization/module-scope.decorator';
import { AccountAccessService } from '../client-scope/account-access.service';
import { UserClientAccess } from '../client-scope/user-client-access.entity';
import { GrantClientAccessDto } from './dto/grant-client-access.dto';
import { Client } from '../../modules/clients/client.entity';

/**
 * Consulta y administración de permisos por módulo.
 */
@ApiTags('Permisos')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('users')
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionResolverService,
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserClientAccess) private readonly clientAccess: Repository<UserClientAccess>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly accountAccess: AccountAccessService,
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
   * Cuentas que ve una persona, con la procedencia de cada una.
   *
   * Distingue lo heredado del pod de lo concedido a mano, que es lo que permite revisar
   * accesos sin reconstruir la decisión: las excepciones se ven como excepciones.
   */
  @Get('users/:id/client-access')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Cuentas visibles de un usuario y por qué las ve' })
  async clientAccessOfUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const user = await this.findUser(id, req.organizationId);
    const access = await this.accountAccess.explain(req.organizationId, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      tenantId: user.organizationId,
    });
    return { userId: user.id, role: user.role, access };
  }

  /** Concede a una persona una cuenta que su pod no le da. */
  @Put('users/:id/client-access/:clientId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Conceder acceso a una cuenta' })
  async grantClientAccess(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
    @Body() dto: GrantClientAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.findUser(id, req.organizationId);
    if (user.role === UserRole.CLIENT) {
      throw new BadRequestException('El acceso de un cliente lo define su propia cuenta, no una asignación');
    }
    const client = await this.clients.findOne({ where: { id: clientId, organizationId: req.organizationId }, select: { id: true } });
    if (!client) throw new NotFoundException('Cuenta no encontrada');

    const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId: client.id } });
    const saved = await this.clientAccess.save({
      ...(existing ?? {}),
      organizationId: req.organizationId,
      userId: user.id,
      clientId: client.id,
      reason: dto.reason ?? null,
      grantedBy: req.user.id,
    });
    this.accountAccess.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserClientAccess',
      entityId: saved.id,
      action: existing ? 'updated' : 'created',
      before: existing ? { reason: existing.reason } : undefined,
      after: { userId: user.id, clientId: client.id, reason: dto.reason ?? null },
    });
    return saved;
  }

  /**
   * Retira una asignación directa.
   *
   * No quita el acceso que venga del pod: para eso hay que sacar a la persona del pod o
   * mover la cuenta. La respuesta indica si, tras retirarla, la cuenta le sigue siendo
   * visible, para que quien administra no crea haber cerrado algo que sigue abierto.
   */
  @Delete('users/:id/client-access/:clientId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Retirar acceso a una cuenta' })
  async revokeClientAccess(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.findUser(id, req.organizationId);
    const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId } });
    if (!existing) throw new NotFoundException('No existe una asignación directa para esa cuenta');

    await this.clientAccess.remove(existing);
    this.accountAccess.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserClientAccess',
      entityId: existing.id,
      action: 'deleted',
      before: { userId: user.id, clientId, reason: existing.reason },
    });

    const remaining = await this.accountAccess.allowedClientIds(req.organizationId, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      tenantId: user.organizationId,
    });
    return {
      removed: true,
      clientId,
      stillVisible: remaining === undefined || remaining.includes(clientId),
    };
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
