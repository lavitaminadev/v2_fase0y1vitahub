import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { Client } from '../clients/client.entity';

const BCRYPT_ROUNDS = 10;

/**
 * Input required to create a user.
 */
interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  organizationId: string;
  role?: UserRole;
  phone?: string;
  clientId?: string;
  workMode?: 'presential' | 'hybrid' | 'remote';
  weeklyCapacityUd?: number;
  actorRole: UserRole;
}

/**
 * Creates a new user with a hashed password.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
  ) {}

  /**
   * Hashes the password and persists the user.
   *
   * @param data - User creation input.
   * @returns Saved user entity.
   */
  async execute(data: CreateUserInput): Promise<User> {
    const normalizedRole = data.role || UserRole.DESIGNER;
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedName = data.name.trim();
    const normalizedPhone = data.phone?.replace(/[^\d+]/g, '');
    if (data.actorRole === UserRole.OPERATIONS_DIRECTOR && [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR].includes(normalizedRole)) {
      throw new ForbiddenException('Operations directors cannot create administrators or operations directors');
    }
    const existing = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('Ya existe una cuenta con este email');
    const clientId = await this.resolveClientId(data.organizationId, normalizedRole, data.clientId);
    const hashed = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = this.repo.create({
      email: normalizedEmail,
      password: hashed,
      name: normalizedName,
      organizationId: data.organizationId,
      role: normalizedRole,
      phone: normalizedPhone,
      clientId,
      workMode: data.workMode,
      weeklyCapacityUd: data.weeklyCapacityUd ?? 20,
      invitedAt: new Date(),
      mustChangePassword: true,
    });
    return this.repo.save(user);
  }

  private async resolveClientId(organizationId: string, role: UserRole, clientId?: string): Promise<string | undefined> {
    if (role !== UserRole.CLIENT) return undefined;
    if (!clientId) throw new BadRequestException('Las cuentas cliente requieren una empresa asignada');
    const client = await this.clientsRepo.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('La empresa seleccionada no pertenece a esta organizacion');
    return client.id;
  }
}
