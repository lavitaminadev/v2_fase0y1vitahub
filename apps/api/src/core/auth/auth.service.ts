import { BadRequestException, Injectable, Logger, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { AuthResponse, UserRole as SharedUserRole } from '@vitahub/shared';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { OrganizationFeatures, normalizeOrganizationFeatures } from '../../modules/organizations/organization-features';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../notifications/email.service';
import { DataConsent } from '../data-protection/consent.entity';
import { CompleteOnboardingDto, REQUIRED_CONSENTS, TERMS_VERSION } from './dto/onboarding.dto';
import { ParameterResolver } from '../parameters/parameter-resolver.service';

const REFRESH_TOKEN_EXPIRES_IN = config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'];

/** Intentos fallidos consecutivos antes de bloquear la cuenta. */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** Duración del bloqueo. Temporal para no convertir el ataque en una denegación de servicio. */
const LOCKOUT_MINUTES = 15;

/**
 * Hash de descarte con el que se compara cuando el correo no existe.
 *
 * Sin esta comparación, un correo inexistente respondería mucho más rápido que uno real y
 * permitiría enumerar qué cuentas están registradas midiendo el tiempo de respuesta.
 */
const ABSENT_USER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Convierte el enum interno de TypeORM a la unión de string-literal compartida.
 *
 * Los valores en tiempo de ejecución son idénticos; este helper satisface al
 * compilador sin debilitar el tipado.
 */
function toSharedRole(role: UserRole): SharedUserRole {
  return role as unknown as SharedUserRole;
}

/**
 * Payload embebido en los JWT de access/refresh token.
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
 * Lógica de negocio de autenticación: validación de contraseña, emisión de
 * tokens, registro y búsqueda de perfil.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(PasswordResetToken) private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly parameters: ParameterResolver,
  ) {}

  /**
   * Valida un par email/contraseña y devuelve el usuario si es válido.
   *
   * @param email - Email del usuario.
   * @param password - Contraseña en texto plano.
   * @returns La entidad del usuario autenticado.
   * @throws UnauthorizedException cuando las credenciales son inválidas.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail, isActive: true },
      select: ['id', 'email', 'name', 'password', 'role', 'organizationId', 'avatarUrl', 'clientId', 'mustChangePassword', 'mustCompleteProfile', 'failedLoginAttempts', 'lockedUntil'],
    });
    // Se compara igual contra un hash ficticio cuando el correo no existe, para que el
    // tiempo de respuesta no revele qué cuentas están registradas.
    if (!user) {
      await bcrypt.compare(password, ABSENT_USER_HASH);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Cuenta bloqueada por intentos fallidos. Vuelve a intentar en ${minutes} minuto(s).`);
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Un acceso correcto cierra el episodio: se borra el contador y cualquier bloqueo.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return user;
  }

  /**
   * Suma un intento fallido y bloquea la cuenta al alcanzar el límite.
   *
   * El bloqueo es temporal a propósito: uno permanente convierte un ataque en una
   * denegación de servicio contra la persona legítima, que es justo lo que busca quien
   * ataca. La cuenta se libera sola pasada la ventana.
   */
  private async registerFailedAttempt(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const reached = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    await this.userRepo.update(user.id, {
      failedLoginAttempts: reached ? 0 : attempts,
      lockedUntil: reached ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil ?? null,
    });
    if (reached) {
      this.logger.warn(`Cuenta ${user.id} bloqueada ${LOCKOUT_MINUTES} min tras ${MAX_FAILED_LOGIN_ATTEMPTS} intentos fallidos`);
    }
  }

  /**
   * Emite tokens de access y refresh para un usuario autenticado.
   *
   * @param user - Entidad del usuario autenticado.
   * @returns Tokens más el resumen del usuario.
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
   * Renueva un access token a partir de un refresh token válido.
   *
   * @param token - Refresh token.
   * @returns Nuevo access token.
   * @throws UnauthorizedException cuando el refresh token es inválido o fue revocado.
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token);
      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        select: ['id', 'refreshToken', 'email', 'role', 'organizationId', 'clientId'],
      });
      const tokenHash = hashRefreshToken(token);
      // Acepta una vez un token en texto plano guardado previamente, y luego lo rota a almacenamiento hasheado.
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
      throw new UnauthorizedException('Token de actualización inválido');
    }
  }

  /**
   * Registra un nuevo usuario y crea una organización si no se provee ninguna.
   *
   * @param data - Datos de registro.
   * @returns Tokens recién creados y resumen del usuario.
   */
  async register(data: { email: string; password: string; name: string }): Promise<AuthResponse> {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new ForbiddenException('El registro publico esta desactivado; solicita tu cuenta a un administrador');
    }
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim().replace(/\s+/g, ' ');
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('El correo ya está registrado');

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

  /** Revoca toda sesión de navegador respaldada por el refresh token actual. */
  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshToken: null });
  }

  /**
   * Devuelve el perfil del usuario por id.
   *
   * @param userId - Identificador del usuario.
   * @returns Entidad del usuario o null.
   */
  /**
   * Perfil del usuario mas los modulos habilitados en su organizacion.
   *
   * Los `features` viajan aca para que el frontend construya el menu con la misma verdad
   * que aplica el backend, en vez de una lista paralela que puede divergir.
   */
  async me(userId: string): Promise<(User & { features: OrganizationFeatures; mustAcceptTerms: boolean }) | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    const organization = await this.orgRepo.findOne({ where: { id: user.organizationId }, select: ['id', 'features'] });
    return Object.assign(user, {
      features: normalizeOrganizationFeatures(organization?.features),
      mustAcceptTerms: await this.termsPending(user),
    });
  }

  /**
   * Registra una re-aceptación de condiciones sin tocar la contraseña.
   *
   * Es el caso de una renovación: la persona ya tiene su clave y solo debe aceptar el
   * texto vigente porque dirección publicó una versión nueva o venció el plazo. Pedirle la
   * contraseña temporal aquí no tendría sentido, porque hace tiempo que no la usa.
   */
  async acceptCurrentTerms(userId: string, acceptedConsents: string[], ipAddress?: string): Promise<{ accepted: true }> {
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'organizationId'] });
    if (!user) throw new BadRequestException('Usuario no disponible');

    const missing = REQUIRED_CONSENTS.filter((key) => !acceptedConsents.includes(key));
    if (missing.length > 0) throw new BadRequestException('Debes aceptar todas las condiciones para continuar');

    const version = await this.parameters.get('compliance.terms_version', null, null, user.organizationId) ?? TERMS_VERSION;
    const now = new Date();
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(User, userId, { termsAcceptedAt: now, termsVersion: String(version) });
      await manager.save(
        DataConsent,
        REQUIRED_CONSENTS.map((action) => manager.create(DataConsent, {
          userId,
          action: `${action}@${version}`,
          granted: true,
          ipAddress: ipAddress ?? null,
        })),
      );
    });
    this.logger.log(`Usuario ${userId} re-aceptó las condiciones ${version}`);
    return { accepted: true };
  }

  /**
   * Indica si la persona debe (volver a) aceptar las condiciones.
   *
   * Dirección controla tres parámetros: si la exigencia está activa, cuál es la versión
   * vigente y cada cuántos meses hay que renovar la aceptación. Publicar una actualización
   * es cambiar la versión: al hacerlo, todo el equipo vuelve a aceptar la próxima vez que
   * entre, sin tocar código ni desplegar.
   *
   * Ante un fallo al leer los parámetros no se bloquea el acceso: se registra y se deja
   * pasar, porque dejar al equipo fuera de la herramienta es peor que un día sin re-aceptar.
   */
  private async termsPending(user: User): Promise<boolean> {
    try {
      const [enforced, version, renewalMonths] = await Promise.all([
        this.parameters.get('compliance.terms_enforced', null, null, user.organizationId),
        this.parameters.get('compliance.terms_version', null, null, user.organizationId),
        this.parameters.get('compliance.terms_renewal_months', null, null, user.organizationId),
      ]);
      if (enforced === false) return false;
      if (!user.termsAcceptedAt) return true;
      if (version && user.termsVersion !== version) return true;

      const months = Number(renewalMonths) || 0;
      if (months <= 0) return false;
      const dueAt = new Date(user.termsAcceptedAt);
      dueAt.setMonth(dueAt.getMonth() + months);
      return dueAt.getTime() <= Date.now();
    } catch (error) {
      this.logger.warn(`No se pudo evaluar la vigencia de condiciones de ${user.id}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   *
   * @param userId - Identificador del usuario.
   * @param data - Campos del perfil a actualizar.
   * @returns Entidad del usuario actualizada.
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

  /**
   * Completa el primer ingreso: contraseña propia, consentimientos y datos personales.
   *
   * Las tres cosas ocurren en una transacción porque describen un mismo acto. Antes la
   * aceptación de términos solo controlaba la interfaz y no se guardaba en ningún lado, de
   * modo que no había forma de demostrar que alguien había aceptado nada.
   *
   * La sesión se invalida al terminar (`refreshToken: null`) para que la contraseña de
   * invitación deje de servir de inmediato.
   *
   * @param ipAddress - Origen de la aceptación, parte del registro de consentimiento.
   */
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto, ipAddress?: string): Promise<{ completed: true }> {
    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
      select: ['id', 'password', 'organizationId'],
    });
    if (!user || !await bcrypt.compare(dto.currentPassword, user.password)) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (await bcrypt.compare(dto.newPassword, user.password)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente');
    }

    const missing = REQUIRED_CONSENTS.filter((key) => !dto.acceptedConsents.includes(key));
    if (missing.length > 0) {
      throw new BadRequestException('Debes aceptar todas las condiciones para continuar');
    }

    const now = new Date();
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(User, userId, {
        name: dto.profile.name.trim(),
        phone: dto.profile.phone?.replace(/[^\d+]/g, '') || null,
        workMode: dto.profile.workMode,
        password: await bcrypt.hash(dto.newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
        mustChangePassword: false,
        mustCompleteProfile: false,
        passwordChangedAt: now,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        refreshToken: null,
      });
      await manager.save(
        DataConsent,
        REQUIRED_CONSENTS.map((action) => manager.create(DataConsent, {
          userId,
          action: `${action}@${TERMS_VERSION}`,
          granted: true,
          ipAddress: ipAddress ?? null,
        })),
      );
    });

    this.logger.log(`Usuario ${userId} completó el primer ingreso y aceptó ${TERMS_VERSION}`);
    return { completed: true };
  }
}
