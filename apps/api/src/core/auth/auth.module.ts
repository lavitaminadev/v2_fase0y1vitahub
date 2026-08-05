import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './auth.guard';
import { OrganizationContextGuard } from '../organization/organization-context.guard';
import { RolesGuard } from '../authorization/roles.guard';
import { FeatureGuard } from '../authorization/feature.guard';
import { DataConsent } from '../data-protection/consent.entity';
import { ParametersModule } from '../parameters/parameters.module';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { config } from '../../config';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailModule } from '../notifications/email.module';

const ACCESS_TOKEN_EXPIRES_IN = config.jwt.expiresIn as JwtSignOptions['expiresIn'];

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, PasswordResetToken, DataConsent]),
    ParametersModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: config.jwt.secret, signOptions: { expiresIn: ACCESS_TOKEN_EXPIRES_IN } }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Inmediatamente despues de la autenticacion: fija req.organizationId desde el JWT, de
    // modo que los guards siguientes y los controladores ya la encuentren resuelta.
    { provide: APP_GUARD, useClass: OrganizationContextGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Va despues de RolesGuard a proposito: el orden de registro es el orden de ejecucion, y
    // este necesita la organizacion ya resuelta en la peticion.
    FeatureGuard,
    { provide: APP_GUARD, useExisting: FeatureGuard },
  ],
  exports: [AuthService, JwtModule, FeatureGuard],
})
export class AuthModule {}
