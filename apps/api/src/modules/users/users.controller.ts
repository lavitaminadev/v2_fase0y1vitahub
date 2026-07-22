import { Controller, Get, Post, Body, Query, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserUseCase } from './create-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateUserUseCase } from './update-user.use-case';
import { ResetUserPasswordUseCase } from './reset-user-password.use-case';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

/**
 * User management endpoints.
 */
@ApiTags('Usuarios')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly resetUserPassword: ResetUserPasswordUseCase,
  ) {}

  /**
   * Creates a new user inside the caller's organization.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.createUser.execute({
      ...dto,
      organizationId: req.organizationId || req.user.organizationId,
      actorRole: req.user.role as UserRole,
    });
  }

  /**
   * Lists users scoped to the caller's organization.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Listar usuarios' })
  list(
    @Query('role') role: UserRole | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('isActive') isActive: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const normalizedIsActive = isActive == null
      ? undefined
      : isActive.toLowerCase() === 'true'
        ? true
        : isActive.toLowerCase() === 'false'
          ? false
          : undefined;

    return this.listUsers.execute({
      organizationId: req.organizationId || req.user.organizationId,
      role,
      clientId,
      q,
      isActive: normalizedIsActive,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.updateUser.execute({
      id,
      organizationId: req.organizationId || req.user.organizationId,
      actorId: req.user.id,
      actorRole: req.user.role as UserRole,
      ...dto,
    });
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Generar una contraseña temporal y revocar sesiones activas' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto, @Req() req: AuthenticatedRequest) {
    return this.resetUserPassword.execute({
      id,
      organizationId: req.organizationId || req.user.organizationId,
      actorRole: req.user.role as UserRole,
      sendEmail: dto.sendEmail,
    });
  }
}
