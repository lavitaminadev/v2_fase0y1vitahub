import { Controller, Post, Body, Get, Put, HttpCode, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './auth.guard';
import type { AuthUser } from '../../shared/types/request';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { Request, Response } from 'express';
import { config } from '../../config';
import { ChangePasswordDto, CompletePasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';

const REFRESH_COOKIE = 'vitahub_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';

function sessionDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * units[match[2] as keyof typeof units];
}

const REFRESH_COOKIE_MAX_AGE_MS = sessionDurationMs(config.jwt.refreshExpiresIn);

function readCookie(request: Request, name: string): string | undefined {
  const match = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
}

/**
 * Authentication endpoints: login, register, refresh, and profile.
 */
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Registers a new user and optionally links them to an organization.
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...session } = await this.auth.register(dto);
    setRefreshCookie(response, refreshToken);
    return session;
  }

  /**
   * Validates credentials and returns access/refresh tokens.
   */
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const tokens = await this.auth.login(user);
    setRefreshCookie(response, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        clientId: user.clientId,
        organizationId: user.organizationId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Issues a new access token from a valid refresh token.
   */
  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar token de acceso' })
  @ApiBody({ type: RefreshDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readCookie(request, REFRESH_COOKIE) ?? dto?.refreshToken;
    const refreshed = await this.auth.refreshToken(token ?? '');
    setRefreshCookie(response, refreshed.refreshToken);
    return { accessToken: refreshed.accessToken };
  }

  /** Revokes the persisted session and removes the browser cookie. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesion y revocar credenciales' })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(user.id);
    clearRefreshCookie(response);
  }

  /**
   * Returns the authenticated user profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /**
   * Updates the authenticated user profile.
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del usuario' })
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Public()
  @Post('password/request-reset')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('password/reset')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({ summary: 'Completar recuperación de contraseña' })
  completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    return this.auth.completePasswordReset(dto.token, dto.password);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña autenticada' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
