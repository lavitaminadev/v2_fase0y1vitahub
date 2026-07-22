import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { Objective } from './objective.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { CreateObjectiveDto, UpdateObjectiveDto } from './dto/objective.dto';

@Controller('objectives')
export class ObjectivesController {
  constructor(
    @InjectRepository(Objective) private readonly repo: Repository<Objective>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
  list(@Req() req: AuthenticatedRequest) {
    const personalRoles = [UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL];
    return this.repo.find({
      where: {
        organizationId: req.organizationId!,
        ...(personalRoles.includes(req.user.role as UserRole) ? { ownerId: req.user.id } : {}),
      },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  async create(@Body() dto: CreateObjectiveDto, @Req() req: AuthenticatedRequest) {
    await this.validateReferences(req.organizationId!, dto.ownerId, dto.clientId);
    return this.repo.save(this.repo.create({
      ...dto,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      organizationId: req.organizationId!,
      createdBy: req.user.id,
      progress: dto.progress ?? 0,
    }));
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  async update(@Param('id') id: string, @Body() dto: UpdateObjectiveDto, @Req() req: AuthenticatedRequest) {
    const objective = await this.repo.findOne({ where: { id, organizationId: req.organizationId! } });
    if (!objective) throw new NotFoundException('Objective not found');
    await this.validateReferences(req.organizationId!, dto.ownerId, dto.clientId);
    if (dto.ownerId !== undefined) objective.ownerId = dto.ownerId;
    if (dto.clientId !== undefined) objective.clientId = dto.clientId;
    if (dto.category !== undefined) objective.category = dto.category;
    if (dto.title !== undefined) objective.title = dto.title.trim();
    if (dto.description !== undefined) objective.description = dto.description.trim() || undefined;
    if (dto.status !== undefined) objective.status = dto.status;
    if (dto.progress !== undefined) objective.progress = dto.progress;
    if (dto.dueAt !== undefined) objective.dueAt = new Date(dto.dueAt);
    if (objective.progress === 100) objective.status = 'completed';
    return this.repo.save(objective);
  }

  private async validateReferences(organizationId: string, ownerId?: string, clientId?: string): Promise<void> {
    const [owner, client] = await Promise.all([
      ownerId ? this.users.findOne({ where: { id: ownerId, organizationId, isActive: true } }) : undefined,
      clientId ? this.clients.findOne({ where: { id: clientId, organizationId } }) : undefined,
    ]);
    if (ownerId && !owner) throw new BadRequestException('El responsable no pertenece a esta organizacion');
    if (clientId && !client) throw new BadRequestException('El cliente no pertenece a esta organizacion');
  }
}
