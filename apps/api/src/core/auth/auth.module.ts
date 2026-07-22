import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './auth.guard';
import { RolesGuard } from '../authorization/roles.guard';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { config } from '../../config';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailModule } from '../notifications/email.module';

const ACCESS_TOKEN_EXPIRES_IN = config.jwt.expiresIn as JwtSignOptions['expiresIn'];

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, PasswordResetToken]),
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: config.jwt.secret, signOptions: { expiresIn: ACCESS_TOKEN_EXPIRES_IN } }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
