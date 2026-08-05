import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { Organization } from '../../modules/organizations/organization.entity';
import { User } from '../../modules/users/user.entity';
import { Client } from '../../modules/clients/client.entity';
import { UserPermissionOverride } from './user-permission-override.entity';
import { UserClientAccess } from '../client-scope/user-client-access.entity';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionGuard } from './permission.guard';
import { PermissionsController } from './permissions.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Autorización por módulo: resolución de niveles, guard que la aplica y administración de
 * excepciones —tanto por módulo como por cuenta—.
 *
 * El guard se registra de forma global y niega los endpoints que no declaran módulo, de
 * modo que lo configurado en la pantalla de permisos es también lo que ocurre en la API.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User, Client, UserPermissionOverride, UserClientAccess]),
    AuditModule,
  ],
  controllers: [PermissionsController],
  providers: [
    PermissionResolverService,
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PermissionResolverService, TypeOrmModule],
})
export class AuthorizationModule {}
