import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';

/**
 * Passport JWT strategy for NestJS.
 *
 * Validates the bearer token, loads the user from the database, and attaches a
 * sanitized user object to the request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  /**
   * Validates a decoded JWT payload and returns the authenticated user shape.
   *
   * @param payload - Decoded JWT payload.
   * @returns Sanitized user object attached to `req.user`.
   * @throws UnauthorizedException when the user is not found or inactive.
   */
  async validate(payload: { sub: string; email: string; organizationId: string; role: UserRole; clientId?: string; iat?: number }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    // A password change/reset revokes the refresh token but access tokens already
    // issued keep working until they expire. Reject any access token minted before
    // the last password change so a stolen token dies the moment the password
    // is rotated, instead of surviving up to JWT_EXPIRES_IN longer.
    if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new UnauthorizedException('Session invalidated by a password change');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      name: user.name,
      tenantId: user.organizationId,
    };
  }
}
