import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Moodboard } from './moodboard.entity';
import { Session } from './session.entity';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import { UpdateMoodboardDto } from './dto/update-moodboard.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

/**
 * Business logic for audiovisual moodboards and sessions.
 */
@Injectable()
export class AudiovisualService {
  constructor(
    @InjectRepository(Moodboard) private readonly moodboardRepo: Repository<Moodboard>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Moodboard CRUD
  async createMoodboard(dto: CreateMoodboardDto, organizationId: string, createdBy: string): Promise<Moodboard> {
    await this.validateClient(dto.clientId, organizationId);
    const entity = this.moodboardRepo.create({
      ...dto,
      organizationId,
      createdBy,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
    });
    return this.moodboardRepo.save(entity);
  }

  async findAllMoodboards(organizationId: string, limit = 50, offset = 0): Promise<{ data: Moodboard[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.moodboardRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: { client: true },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOneMoodboard(id: string, organizationId: string): Promise<Moodboard> {
    const entity = await this.moodboardRepo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Moodboard not found');
    return entity;
  }

  async updateMoodboard(id: string, dto: UpdateMoodboardDto, organizationId: string): Promise<Moodboard> {
    const entity = await this.findOneMoodboard(id, organizationId);
    await this.validateUsers(dto.verifiedBy ? [dto.verifiedBy] : [], organizationId);
    Object.assign(entity, dto);
    if (dto.title !== undefined) entity.title = dto.title.trim();
    if (dto.description !== undefined) entity.description = dto.description.trim() || undefined;
    return this.moodboardRepo.save(entity);
  }

  async removeMoodboard(id: string, organizationId: string): Promise<Moodboard> {
    const entity = await this.findOneMoodboard(id, organizationId);
    return this.moodboardRepo.remove(entity);
  }

  // Session CRUD
  async createSession(dto: CreateSessionDto, organizationId: string): Promise<Session> {
    await this.validateSessionReferences(dto.clientId, dto.moodboardId, dto.assignedTeam, organizationId);
    const entity = this.sessionRepo.create({
      ...dto,
      organizationId,
      date: new Date(dto.date),
      location: dto.location?.trim() || undefined,
    });
    return this.sessionRepo.save(entity);
  }

  async findAllSessions(organizationId: string, limit = 50, offset = 0, assignedTo?: string): Promise<{ data: Session[]; total: number; limit: number; offset: number }> {
    const query = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.client', 'client')
      .where('session.organization_id = :organizationId', { organizationId })
      .orderBy('session.date', 'DESC')
      .take(limit)
      .skip(offset);
    if (assignedTo) query.andWhere('JSON_CONTAINS(session.assigned_team, :assignedTo)', { assignedTo: JSON.stringify(assignedTo) });
    const [data, total] = await query.getManyAndCount();
    return { data, total, limit, offset };
  }

  async findOneSession(id: string, organizationId: string): Promise<Session> {
    const entity = await this.sessionRepo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Session not found');
    return entity;
  }

  async updateSession(id: string, dto: UpdateSessionDto, organizationId: string): Promise<Session> {
    const entity = await this.findOneSession(id, organizationId);
    await this.validateSessionReferences(entity.clientId, dto.moodboardId ?? entity.moodboardId, dto.assignedTeam, organizationId);
    Object.assign(entity, dto);
    if (dto.date !== undefined) entity.date = new Date(dto.date);
    if (dto.location !== undefined) entity.location = dto.location.trim() || undefined;
    return this.sessionRepo.save(entity);
  }

  async removeSession(id: string, organizationId: string): Promise<Session> {
    const entity = await this.findOneSession(id, organizationId);
    return this.sessionRepo.remove(entity);
  }

  private async validateClient(clientId: string, organizationId: string): Promise<void> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organizacion');
  }

  private async validateUsers(userIds: string[] = [], organizationId: string): Promise<void> {
    if (!userIds.length) return;
    const uniqueIds = [...new Set(userIds)];
    const count = await this.users.createQueryBuilder('user')
      .where('user.organization_id = :organizationId AND user.is_active = 1', { organizationId })
      .andWhere('user.id IN (:...userIds)', { userIds: uniqueIds })
      .getCount();
    if (count !== uniqueIds.length) throw new BadRequestException('El equipo asignado contiene usuarios invalidos');
  }

  private async validateSessionReferences(clientId: string, moodboardId: string | undefined, assignedTeam: string[] | undefined, organizationId: string): Promise<void> {
    await Promise.all([this.validateClient(clientId, organizationId), this.validateUsers(assignedTeam, organizationId)]);
    if (!moodboardId) return;
    const moodboard = await this.moodboardRepo.findOne({ where: { id: moodboardId, organizationId, clientId } });
    if (!moodboard) throw new BadRequestException('El moodboard no pertenece al cliente seleccionado');
  }
}
