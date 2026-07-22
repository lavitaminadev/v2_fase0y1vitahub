import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Lead } from '../leads/lead.entity';

/**
 * Business logic for CRM contacts.
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly repo: Repository<Contact>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
  ) {}

  async create(dto: CreateContactDto, organizationId: string): Promise<Contact> {
    await this.assertLead(dto.leadId, organizationId);
    const contact = this.repo.create({
      ...dto,
      organizationId,
      name: dto.name.trim().replace(/\s+/g, ' '),
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.replace(/[^\d+]/g, '') || undefined,
      position: dto.position?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
    });
    return this.repo.save(contact);
  }

  async findAll(organizationId: string, limit = 50, offset = 0): Promise<{ data: Contact[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Contact> {
    const contact = await this.repo.findOne({ where: { id, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(id: string, dto: UpdateContactDto, organizationId: string): Promise<Contact> {
    const contact = await this.findOne(id, organizationId);
    await this.assertLead(dto.leadId, organizationId);
    Object.assign(contact, dto);
    if (dto.name !== undefined) contact.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.email !== undefined) contact.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) contact.phone = dto.phone.replace(/[^\d+]/g, '') || undefined;
    if (dto.position !== undefined) contact.position = dto.position.trim() || undefined;
    if (dto.notes !== undefined) contact.notes = dto.notes.trim() || undefined;
    return this.repo.save(contact);
  }

  async remove(id: string, organizationId: string): Promise<Contact> {
    const contact = await this.findOne(id, organizationId);
    return this.repo.remove(contact);
  }

  private async assertLead(leadId: string | null | undefined, organizationId: string): Promise<void> {
    if (!leadId) return;
    const lead = await this.leads.findOne({ where: { id: leadId, organizationId }, select: { id: true } });
    if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
  }
}
