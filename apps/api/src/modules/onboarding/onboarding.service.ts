import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Onboarding } from './onboarding.entity';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { WorkflowsService } from '../workflows/workflows.service';

/**
 * Business logic for client onboarding steps.
 */
@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Onboarding) private readonly repo: Repository<Onboarding>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly workflows: WorkflowsService,
  ) {}

  async create(dto: CreateOnboardingDto, organizationId: string): Promise<Onboarding> {
    await this.validateReferences(dto.clientId, dto.assignedTo, organizationId);
    const item = this.repo.create({ ...dto, organizationId, step: dto.step.trim(), notes: dto.notes?.trim() || undefined, blockedReason: dto.blockedReason?.trim() || undefined });
    return this.repo.save(item);
  }

  async findAll(organizationId: string, limit = 50, offset = 0): Promise<{ data: Onboarding[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Onboarding> {
    const item = await this.repo.findOne({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Onboarding step not found');
    return item;
  }

  async update(id: string, dto: UpdateOnboardingDto, organizationId: string): Promise<Onboarding> {
    const item = await this.findOne(id, organizationId);
    if (dto.assignedTo) await this.validateReferences(item.clientId, dto.assignedTo, organizationId);
    Object.assign(item, dto);
    if (dto.step !== undefined) item.step = dto.step.trim();
    if (dto.notes !== undefined) item.notes = dto.notes.trim() || undefined;
    if (dto.blockedReason !== undefined) item.blockedReason = dto.blockedReason.trim() || undefined;
    if (dto.status === 'completed' && !item.completedAt) item.completedAt = new Date();
    if (dto.status && dto.status !== 'completed') item.completedAt = undefined;
    return this.repo.save(item);
  }

  async remove(id: string, organizationId: string): Promise<Onboarding> {
    const item = await this.findOne(id, organizationId);
    return this.repo.remove(item);
  }

  async createStandardChecklist(clientId: string, organizationId: string): Promise<Onboarding[]> {
    await this.validateReferences(clientId, undefined, organizationId);
    const existing = await this.repo.find({ where: { clientId, organizationId } });
    const existingSteps = new Set(existing.map((item) => item.step.trim().toLowerCase()));

    const workflowSteps = await this.workflows.getSteps(organizationId, 'onboarding');
    const missing = workflowSteps
      .filter((step) => !existingSteps.has(step.label.toLowerCase()))
      .map((step) => this.repo.create({
        clientId,
        organizationId,
        step: step.label,
        status: 'pending',
        notes: step.slaHours ? `SLA sugerido: ${step.slaHours} horas${step.responsibleRole ? ` · Responsable: ${step.responsibleRole}` : ''}` : undefined,
      }));

    if (missing.length === 0) return existing;
    return this.repo.save(missing);
  }

  private async validateReferences(clientId: string, assignedTo: string | undefined, organizationId: string): Promise<void> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    if (assignedTo) {
      const user = await this.users.findOne({ where: { id: assignedTo, organizationId, isActive: true } });
      if (!user) throw new BadRequestException('El responsable no pertenece a esta organización o está inactivo');
    }
  }
}
