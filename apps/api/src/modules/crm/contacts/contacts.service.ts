import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Lead } from '../leads/lead.entity';

/** Marca un alcance que no puede coincidir con ningún registro. */
const EMPTY_SCOPE = Symbol('empty-client-scope');

interface SegmentCounts {
  total: number;
  frequent: number;
  vip: number;
  inactive90: number;
}

/**
 * Arma la lista de segmentos con sus etiquetas.
 *
 * Los cuatro segmentos se devuelven siempre, incluso en cero: una pantalla que muestra
 * cuatro tarjetas o ninguna según el alcance de quien mira se lee como un error.
 */
function buildSegments(counts: SegmentCounts): Array<{ id: string; label: string; count: number }> {
  return [
    { id: 'total', label: 'Todos los contactos', count: counts.total },
    { id: 'frequent', label: 'Clientes frecuentes (3+ reservas)', count: counts.frequent },
    { id: 'vip', label: 'Clientes VIP (5+ asistencias)', count: counts.vip },
    { id: 'inactive_90d', label: 'No visitan hace 90 días', count: counts.inactive90 },
  ];
}

/** Segmentos de quien no alcanza ninguna cuenta: la pantalla existe, con todo en cero. */
const EMPTY_SEGMENTS = buildSegments({ total: 0, frequent: 0, vip: 0, inactive90: 0 });

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
   * Lista los contactos que la persona puede ver.
   *
   * @param clientId - Acota el listado a la audiencia de una cuenta concreta.
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` significa sin
   * límite. Un contacto sin cuenta queda fuera para quien está acotado, igual que en leads:
   * si no pertenece a ninguna cuenta asignada, no hay motivo para que lo vea.
   */
  async findAll(
    organizationId: string,
    limit = 50,
    offset = 0,
    clientId?: string,
    allowedClientIds?: string[],
  ): Promise<{ data: Contact[]; total: number; limit: number; offset: number }> {
    const scope = this.clientScope(clientId, allowedClientIds);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0, limit, offset };

    const [data, total] = await this.repo.findAndCount({
      where: scope ? { organizationId, clientId: scope } : { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Contact> {
    const contact = await this.repo.findOne({ where: { id, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (allowedClientIds !== undefined && (!contact.clientId || !allowedClientIds.includes(contact.clientId))) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  /**
   * Condición de cuenta para una consulta, o `undefined` cuando no hay que acotar.
   *
   * Devuelve `EMPTY_SCOPE` cuando el resultado debe ser vacío. Quien la use debe cortar ahí y
   * no omitir el filtro: omitirlo es exactamente lo que convierte un alcance vacío en acceso
   * a toda la organización.
   */
  private clientScope(clientId?: string, allowedClientIds?: string[]): FindOptionsWhere<Contact>['clientId'] | typeof EMPTY_SCOPE {
    if (allowedClientIds === undefined) return clientId;
    if (allowedClientIds.length === 0) return EMPTY_SCOPE;
    if (clientId) return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
    return In(allowedClientIds);
  }

  async update(id: string, dto: UpdateContactDto, organizationId: string, allowedClientIds?: string[]): Promise<Contact> {
    const contact = await this.findOne(id, organizationId, allowedClientIds);
    await this.assertLead(dto.leadId, organizationId);
    Object.assign(contact, dto);
    if (dto.name !== undefined) contact.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.email !== undefined) contact.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) contact.phone = dto.phone.replace(/[^\d+]/g, '') || undefined;
    if (dto.position !== undefined) contact.position = dto.position.trim() || undefined;
    if (dto.notes !== undefined) contact.notes = dto.notes.trim() || undefined;
    return this.repo.save(contact);
  }

  async remove(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Contact> {
    const contact = await this.findOne(id, organizationId, allowedClientIds);
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
  async segments(organizationId: string, clientId?: string, allowedClientIds?: string[]): Promise<Array<{ id: string; label: string; count: number }>> {
    const scope = this.clientScope(clientId, allowedClientIds);
    if (scope === EMPTY_SCOPE) return EMPTY_SEGMENTS;

    // Los ids ya vienen de la base (pods y asignaciones), nunca del llamador, pero igual van
    // como parámetros: una consulta que interpola ids es una que alguien puede copiar mañana
    // a un caso donde sí vengan de fuera.
    const scopedIds = clientId ? [clientId] : allowedClientIds;
    const clientFilter = scopedIds ? `AND c.client_id IN (${scopedIds.map(() => '?').join(',')})` : '';
    const params = scopedIds ? [organizationId, ...scopedIds] : [organizationId];
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
    return buildSegments({
      total,
      frequent: rows.filter((row) => Number(row.reservations) >= 3).length,
      vip: rows.filter((row) => Number(row.attended) >= 5).length,
      inactive90: rows.filter((row) => row.last_visit && (Date.now() - new Date(row.last_visit).getTime()) > 90 * 24 * 60 * 60 * 1000).length,
    });
  }

  private async assertLead(leadId: string | null | undefined, organizationId: string): Promise<void> {
    if (!leadId) return;
    const lead = await this.leads.findOne({ where: { id: leadId, organizationId }, select: { id: true } });
    if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
  }
}
