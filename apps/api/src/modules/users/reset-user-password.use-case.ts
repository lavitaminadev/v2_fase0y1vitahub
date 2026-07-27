import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { EmailService } from '../../core/notifications/email.service';

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async execute(params: { id: string; organizationId: string; actorRole: UserRole; sendEmail?: boolean }) {
    const user = await this.users.findOne({ where: { id: params.id, organizationId: params.organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (params.actorRole === UserRole.OPERATIONS_DIRECTOR && [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR].includes(user.role)) {
      throw new ForbiddenException('No puedes resetear esta cuenta');
    }

    const temporaryPassword = randomBytes(18).toString('base64url');
    user.password = await bcrypt.hash(temporaryPassword, Number(process.env.BCRYPT_ROUNDS || 10));
    user.mustChangePassword = true;
    // `JwtStrategy` rechaza los tokens emitidos antes de esta marca. Actualizarla invalida
    // los access tokens ya entregados, que de otro modo seguirían siendo válidos hasta
    // expirar aunque se revoque el token de renovación.
    user.passwordChangedAt = new Date();
    user.refreshToken = null;
    await this.users.save(user);

    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const emailSent = params.sendEmail !== false && await this.email.sendTemporaryPassword(
      user.name,
      user.email,
      temporaryPassword,
      `${appUrl}/login`,
    );

    return { userId: user.id, temporaryPassword, emailSent, mustChangePassword: true };
  }
}
