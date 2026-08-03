import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from './interaction.entity';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';

/**
 * Lógica de negocio para las interacciones de CRM.
 */
@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction) private readonly repo: Repository<Interaction>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
  ) {}

  async create(dto: CreateInteractionDto, organizationId: string, actorId: string): Promise<Interaction> {
    await this.validateReferences(dto, organizationId);
    const interaction = this.repo.create({
      ...dto,
      organizationId,
      type: dto.type.trim().toLowerCase(),
      description: dto.description?.trim() || undefined,
      date: dto.date ? new Date(dto.date) : new Date(),
      createdBy: actorId,
    });
    return this.repo.save(interaction);
  }

  async findAll(
    organizationId: string,
    limit = 50,
    offset = 0,
    leadId?: string,
    clientId?: string,
  ): Promise<{ data: Interaction[]; total: number; limit: number; offset: number }> {
    if (clientId === '__none__') return { data: [], total: 0, limit, offset };
    const where: Record<string, unknown> = { organizationId };
    if (leadId) where.leadId = leadId;
    const query = this.repo.createQueryBuilder('interaction')
      .where('interaction.organization_id = :organizationId', { organizationId })
      .orderBy('interaction.date', 'DESC')
      .take(limit)
      .skip(offset);
    if (leadId) query.andWhere('interaction.lead_id = :leadId', { leadId });
    if (clientId) {
      query
        .leftJoin(Lead, 'lead', 'lead.id = interaction.lead_id AND lead.organization_id = interaction.organization_id')
        .leftJoin(Contact, 'contact', 'contact.id = interaction.contact_id AND contact.organization_id = interaction.organization_id')
        .leftJoin(Lead, 'contact_lead', 'contact_lead.id = contact.lead_id AND contact_lead.organization_id = interaction.organization_id')
        .andWhere('(lead.client_id = :clientId OR contact_lead.client_id = :clientId)', { clientId });
    }

    const [data, total] = await query.getManyAndCount();
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Interaction> {
    const interaction = await this.repo.findOne({ where: { id, organizationId } });
    if (!interaction) throw new NotFoundException('Interaction not found');
    return interaction;
  }

  async update(id: string, dto: UpdateInteractionDto, organizationId: string): Promise<Interaction> {
    const interaction = await this.findOne(id, organizationId);
    await this.validateReferences(dto, organizationId);
    Object.assign(interaction, dto);
    if (dto.type !== undefined) interaction.type = dto.type.trim().toLowerCase();
    if (dto.description !== undefined) interaction.description = dto.description.trim() || undefined;
    if (dto.date !== undefined) interaction.date = new Date(dto.date);
    return this.repo.save(interaction);
  }

  async remove(id: string, organizationId: string): Promise<Interaction> {
    const interaction = await this.findOne(id, organizationId);
    return this.repo.remove(interaction);
  }

  private async validateReferences(
    dto: { leadId?: string | null; contactId?: string | null },
    organizationId: string,
  ): Promise<void> {
    if (dto.leadId) {
      const lead = await this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } });
      if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
    }
    if (dto.contactId) {
      const contact = await this.contacts.findOne({ where: { id: dto.contactId, organizationId }, select: { id: true, leadId: true } });
      if (!contact) throw new BadRequestException('El contacto no pertenece a esta organización');
      if (dto.leadId && contact.leadId && contact.leadId !== dto.leadId) {
        throw new BadRequestException('El contacto no pertenece al lead indicado');
      }
    }
  }
}
