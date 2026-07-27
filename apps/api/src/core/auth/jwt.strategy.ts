import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';

/**
 * Estrategia JWT de Passport para NestJS.
 *
 * Valida el token bearer, carga el usuario desde la base de datos y adjunta un
 * objeto de usuario saneado al request.
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
   * Valida un payload de JWT decodificado y devuelve la forma del usuario autenticado.
   *
   * @param payload - Payload de JWT decodificado.
   * @returns Objeto de usuario saneado adjuntado a `req.user`.
   * @throws UnauthorizedException cuando el usuario no existe o está inactivo.
   */
  async validate(payload: { sub: string; email: string; organizationId: string; role: UserRole; clientId?: string; iat?: number }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    // Un cambio/reset de contraseña revoca el refresh token, pero los access tokens
    // ya emitidos siguen funcionando hasta que expiran. Se rechaza cualquier access
    // token emitido antes del último cambio de contraseña para que un token robado
    // muera en el momento en que se rota la contraseña, en vez de sobrevivir hasta
    // JWT_EXPIRES_IN más tarde.
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
