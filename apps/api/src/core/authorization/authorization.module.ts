import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { Organization } from '../../modules/organizations/organization.entity';
import { User } from '../../modules/users/user.entity';
import { UserPermissionOverride } from './user-permission-override.entity';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionGuard } from './permission.guard';
import { PermissionsController } from './permissions.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Autorización por módulo: resolución de niveles y guard que la aplica.
 *
 * Se registra el guard de forma global; los endpoints sin `@RequiresPermission` no se ven
 * afectados, lo que permite migrar de `@Roles` a permisos de manera gradual.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Organization, User, UserPermissionOverride]), AuditModule],
  controllers: [PermissionsController],
  providers: [
    PermissionResolverService,
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PermissionResolverService, TypeOrmModule],
})
export class AuthorizationModule {}
