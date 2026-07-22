import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './opportunity.entity';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { Lead } from '../leads/lead.entity';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';

/**
 * Business logic for CRM opportunities.
 */
@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateOpportunityDto, organizationId: string): Promise<Opportunity> {
    await this.validateReferences(dto, organizationId);
    const opportunity = this.repo.create({
      ...dto,
      organizationId,
      name: dto.name.trim().replace(/\s+/g, ' '),
      stage: dto.stage?.trim().toLowerCase() || 'new',
      expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      nextAction: dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined,
      nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
    });
    return this.repo.save(opportunity);
  }

  async findAll(
    organizationId: string,
    limit = 50,
    offset = 0,
    leadId?: string,
  ): Promise<{ data: Opportunity[]; total: number; limit: number; offset: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (leadId) where.leadId = leadId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.repo.findOne({ where: { id, organizationId } });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.findOne(id, organizationId);
    await this.validateReferences(dto, organizationId);
    Object.assign(opportunity, dto);
    if (dto.name !== undefined) opportunity.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.stage !== undefined) opportunity.stage = dto.stage.trim().toLowerCase();
    if (dto.expectedCloseDate !== undefined) opportunity.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined;
    if (dto.nextAction !== undefined) opportunity.nextAction = dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined;
    if (dto.nextActionAt !== undefined) opportunity.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : undefined;
    return this.repo.save(opportunity);
  }

  async remove(id: string, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.findOne(id, organizationId);
    return this.repo.remove(opportunity);
  }

  private async validateReferences(
    dto: { leadId?: string | null; clientId?: string | null; assignedTo?: string },
    organizationId: string,
  ): Promise<void> {
    const checks: Promise<unknown>[] = [];
    if (dto.leadId) checks.push(this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } })
      .then((lead) => { if (!lead) throw new BadRequestException('El lead no pertenece a esta organización'); }));
    if (dto.clientId) checks.push(this.clients.findOne({ where: { id: dto.clientId, organizationId }, select: { id: true } })
      .then((client) => { if (!client) throw new BadRequestException('El cliente no pertenece a esta organización'); }));
    if (dto.assignedTo) checks.push(this.users.findOne({ where: { id: dto.assignedTo, organizationId, isActive: true }, select: { id: true } })
      .then((user) => { if (!user) throw new BadRequestException('El responsable no pertenece a esta organización o está inactivo'); }));
    await Promise.all(checks);
  }
}
