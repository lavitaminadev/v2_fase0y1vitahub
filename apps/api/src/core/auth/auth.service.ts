import { BadRequestException, Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { AuthResponse, UserRole as SharedUserRole } from '@vitahub/shared';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../notifications/email.service';

const REFRESH_TOKEN_EXPIRES_IN = config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'];

/**
 * Casts the internal TypeORM enum to the shared string-literal union.
 *
 * Runtime values are identical; this helper satisfies the compiler without
 * weakening type safety.
 */
function toSharedRole(role: UserRole): SharedUserRole {
  return role as unknown as SharedUserRole;
}

/**
 * Token payload embedded in JWT access/refresh tokens.
 */
interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  clientId?: string;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Authentication business logic: password validation, token issuance,
 * registration, and profile lookup.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(PasswordResetToken) private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates an email/password pair and returns the user if valid.
   *
   * @param email - User email.
   * @param password - Plain-text password.
   * @returns The authenticated user entity.
   * @throws UnauthorizedException when credentials are invalid.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail, isActive: true },
      select: ['id', 'email', 'name', 'password', 'role', 'organizationId', 'avatarUrl', 'clientId', 'mustChangePassword'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  /**
   * Issues access and refresh tokens for an authenticated user.
   *
   * @param user - Authenticated user entity.
   * @returns Tokens plus the user summary.
   */
  async login(user: User): Promise<AuthResponse> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
    await this.userRepo.update(user.id, { refreshToken: hashRefreshToken(refreshToken) });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: toSharedRole(user.role),
        organizationId: user.organizationId,
        clientId: user.clientId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Refreshes an access token from a valid refresh token.
   *
   * @param token - Refresh token.
   * @returns New access token.
   * @throws UnauthorizedException when the refresh token is invalid or revoked.
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token);
      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        select: ['id', 'refreshToken', 'email', 'role', 'organizationId', 'clientId'],
      });
      const tokenHash = hashRefreshToken(token);
      // Accept a previously stored raw token once, then rotate it into hashed storage.
      if (!user || (user.refreshToken !== tokenHash && user.refreshToken !== token)) {
        throw new UnauthorizedException();
      }
      const newPayload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        clientId: user.clientId,
      };
      const accessToken = this.jwtService.sign(newPayload);
      const refreshToken = this.jwtService.sign(newPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
      await this.userRepo.update(user.id, { refreshToken: hashRefreshToken(refreshToken) });
      return { accessToken, refreshToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Registers a new user and creates an organization if none is provided.
   *
   * @param data - Registration data.
   * @returns Newly created tokens and user summary.
   */
  async register(data: { email: string; password: string; name: string }): Promise<AuthResponse> {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new ForbiddenException('El registro publico esta desactivado; solicita tu cuenta a un administrador');
    }
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim().replace(/\s+/g, ' ');
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const code = `${email.split('@')[0]}-${Date.now().toString(36)}`;
    const org = await this.orgRepo.save(this.orgRepo.create({ name: `${name} - Organizacion`, code }));

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hashed = await bcrypt.hash(data.password, rounds);
    const user = this.userRepo.create({
      email,
      password: hashed,
      name,
      organizationId: org.id,
      role: UserRole.ADMIN,
    });
    const saved = await this.userRepo.save(user);
    const payload: TokenPayload = {
      sub: saved.id,
      email: saved.email,
      role: saved.role,
      organizationId: saved.organizationId,
      clientId: saved.clientId,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
    await this.userRepo.update(saved.id, { refreshToken: hashRefreshToken(refreshToken) });
    return {
      accessToken,
      refreshToken,
      user: {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        role: toSharedRole(saved.role),
        organizationId: saved.organizationId,
        clientId: saved.clientId,
        mustChangePassword: saved.mustChangePassword,
      },
    };
  }

  /** Revokes every browser session backed by the current refresh token. */
  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshToken: null });
  }

  /**
   * Returns the user profile by id.
   *
   * @param userId - User identifier.
   * @returns User entity or null.
   */
  async me(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  /**
   * Updates the profile of the authenticated user.
   *
   * @param userId - User identifier.
   * @param data - Profile fields to update.
   * @returns Updated user entity.
   */
  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User | null> {
    const patch = {
      ...(data.name !== undefined ? { name: data.name.trim().replace(/\s+/g, ' ') } : {}),
      ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
    };
    await this.userRepo.update(userId, patch);
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async requestPasswordReset(rawEmail: string): Promise<{ accepted: true }> {
    const user = await this.userRepo.findOne({ where: { email: rawEmail.trim().toLowerCase(), isActive: true } });
    if (!user) return { accepted: true };

    const now = new Date();
    await this.resetRepo.update({ userId: user.id, usedAt: IsNull() }, { usedAt: now });
    const token = randomBytes(32).toString('base64url');
    await this.resetRepo.save(this.resetRepo.create({
      organizationId: user.organizationId,
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    }));
    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    await this.emailService.sendPasswordReset(user.name, user.email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
    return { accepted: true };
  }

  async completePasswordReset(token: string, password: string): Promise<{ changed: true }> {
    const now = new Date();
    const record = await this.resetRepo.findOne({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        usedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
    if (!record) throw new BadRequestException('El enlace no es válido o ya venció');
    const user = await this.userRepo.findOne({ where: { id: record.userId, organizationId: record.organizationId, isActive: true } });
    if (!user) throw new BadRequestException('La cuenta ya no está disponible');
    user.password = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.refreshToken = null;
    record.usedAt = now;
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.save(User, user);
      await manager.save(PasswordResetToken, record);
    });
    return { changed: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ changed: true }> {
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'password', 'mustChangePassword'] });
    if (!user || !await bcrypt.compare(currentPassword, user.password)) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (await bcrypt.compare(newPassword, user.password)) throw new BadRequestException('La nueva contraseña debe ser diferente');
    await this.userRepo.update(userId, {
      password: await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      refreshToken: null,
    });
    return { changed: true };
  }
}
