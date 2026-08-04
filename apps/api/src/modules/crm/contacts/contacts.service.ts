import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Lead } from '../leads/lead.entity';

/**
 * Lógica de negocio para los contactos de CRM.
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly repo: Repository<Contact>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly dataSource: DataSource,
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

  /**
   * Lista los contactos de la organización.
   *
   * @param clientId - Acota el listado a la audiencia de un cliente. Sin él se devuelven todos
   * los de la organización, que es lo que necesita el equipo interno.
   */
  async findAll(organizationId: string, limit = 50, offset = 0, clientId?: string): Promise<{ data: Contact[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: clientId ? { organizationId, clientId } : { organizationId },
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

  /**
   * Segmentos de contactos calculados desde reservas reales (vía `reservations.contact_id`).
   *
   * Solo se ofrecen los segmentos que se pueden calcular con datos que el sistema realmente
   * captura hoy. "Cumpleaños del mes" e "interesados en eventos" quedaron fuera: no existe un
   * campo de fecha de nacimiento ni un sistema de etiquetado de intereses, y no vamos a inventar
   * un número a partir de datos que no tenemos.
   */
  async segments(organizationId: string, clientId?: string): Promise<Array<{ id: string; label: string; count: number }>> {
    const clientFilter = clientId ? 'AND c.client_id = ?' : '';
    const params = clientId ? [organizationId, clientId] : [organizationId];
    const totalRow = await this.dataSource.query(
      `SELECT COUNT(*) total FROM crm_contacts c WHERE c.organization_id = ? ${clientFilter}`, params,
    );
    const total = Number(totalRow?.[0]?.total ?? 0);
    const stats = await this.dataSource.query(
      `SELECT c.id,
              COUNT(r.id) reservations,
              SUM(r.status = 'attended') attended,
              MAX(r.starts_at) last_visit
       FROM crm_contacts c
       LEFT JOIN reservations r ON r.contact_id = c.id AND r.status NOT LIKE 'cancelled%'
       WHERE c.organization_id = ? ${clientFilter}
       GROUP BY c.id`,
      params,
    );
    const rows = stats as Array<{ id: string; reservations: number; attended: number; last_visit: string | null }>;
    const vip = rows.filter((row) => Number(row.attended) >= 5).length;
    const frequent = rows.filter((row) => Number(row.reservations) >= 3).length;
    const inactive90 = rows.filter((row) => row.last_visit && (Date.now() - new Date(row.last_visit).getTime()) > 90 * 24 * 60 * 60 * 1000).length;
    return [
      { id: 'total', label: 'Todos los contactos', count: total },
      { id: 'frequent', label: 'Clientes frecuentes (3+ reservas)', count: frequent },
      { id: 'vip', label: 'Clientes VIP (5+ asistencias)', count: vip },
      { id: 'inactive_90d', label: 'No visitan hace 90 días', count: inactive90 },
    ];
  }

  private async assertLead(leadId: string | null | undefined, organizationId: string): Promise<void> {
    if (!leadId) return;
    const lead = await this.leads.findOne({ where: { id: leadId, organizationId }, select: { id: true } });
    if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
  }
}
