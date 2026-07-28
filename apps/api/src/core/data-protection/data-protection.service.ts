import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { Contact } from '../../modules/crm/contacts/contact.entity';
import { Reservation } from '../../modules/reservations/domain/reservation.entity';

@Injectable()
export class DataProtectionService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(DataConsent) private consentRepo: Repository<DataConsent>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Reservation) private reservationRepo: Repository<Reservation>,
  ) {}

  /**
   * Deja constancia de una anonimizacion en la bitacora.
   *
   * Anonimizar destruye el dato original de forma irreversible, asi que el rastro de que
   * ocurrio y por que es lo unico que queda para responder ante una auditoria.
   */
  private async recordAnonymization(organizationId: string, entityType: string, entityId: string, reason: string): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create({
      organizationId,
      action: 'anonymize',
      entityType,
      entityId,
      reason,
      occurredAt: new Date(),
    }));
  }

  async anonymizeUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.update(userId, {
      name: 'Usuario Anónimo',
      email: `anon-${userId}@vitahub.local`,
      phone: null,
      avatarUrl: null,
      refreshToken: null,
      isActive: false,
    });

    await this.auditRepo.update({ actorId: userId }, { actorId: null });
    await this.recordAnonymization(user.organizationId, 'User', userId, 'Solicitud de anonimización');
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const consents = await this.consentRepo.findBy({ userId });
    const auditLogs = await this.auditRepo.findBy({ actorId: userId, organizationId: user.organizationId });

    return {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      consents: consents.map(c => ({ action: c.action, granted: c.granted, createdAt: c.createdAt })),
      auditLogs: auditLogs.map(a => ({ action: a.action, entityType: a.entityType, entityId: a.entityId, occurredAt: a.occurredAt })),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    await this.anonymizeUser(userId);

    await this.consentRepo.delete({ userId });
  }

  async exportLeadData(leadId: string, organizationId: string): Promise<Record<string, unknown>> {
    const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
    if (!lead) throw new NotFoundException('Lead not found');

    const auditLogs = await this.auditRepo.findBy({ organizationId, entityType: 'Lead', entityId: leadId });

    return {
      lead,
      auditLogs: auditLogs.map((log) => ({
        action: log.action,
        occurredAt: log.occurredAt,
        reason: log.reason,
      })),
    };
  }

  async anonymizeLead(leadId: string, organizationId: string, reason = 'Retención expirada'): Promise<Lead> {
    const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
    if (!lead) throw new NotFoundException('Lead not found');

    const anonymizedName = `Lead anonimizado ${lead.id.slice(0, 8)}`;
    lead.name = anonymizedName;
    lead.email = null;
    lead.phone = null;
    lead.company = null;
    lead.sourceDetail = null;
    lead.campaignName = null;
    lead.notes = reason;
    lead.discardReason = reason;
    // Se conserva el resto de `metadata`: sobrescribirlo entero borraba trazas de origen
    // que no son datos personales y que la operacion sigue necesitando.
    lead.metadata = {
      ...(lead.metadata ?? {}),
      retentionAnonymizedAt: new Date().toISOString(),
      retentionReason: reason,
      previousFitStatus: lead.fitStatus,
    };

    const saved = await this.leadRepo.save(lead);
    await this.recordAnonymization(organizationId, 'Lead', leadId, reason);
    return saved;
  }

  /**
   * Anonimiza un contacto de campana: la persona que llego por la campana de un cliente.
   *
   * Se conservan estado, origen y cliente asociado, que son las metricas que sostienen el
   * reporte; se borra todo lo que permite identificar a la persona.
   */
  async anonymizeContact(contactId: string, organizationId: string, reason = 'Retención expirada'): Promise<Contact> {
    const contact = await this.contactRepo.findOneBy({ id: contactId, organizationId });
    if (!contact) throw new NotFoundException('Contact not found');

    contact.name = `Contacto anonimizado ${contact.id.slice(0, 8)}`;
    contact.email = null;
    contact.phone = null;

    const saved = await this.contactRepo.save(contact);
    await this.recordAnonymization(organizationId, 'Contact', contactId, reason);
    return saved;
  }

  /**
   * Anonimiza una reserva: los datos del comensal que capturo la pagina publica.
   *
   * Ademas del nombre y el contacto, se borran los identificadores de match de Meta
   * (`fbc`, `fbp`, IP y user agent) y las respuestas del formulario, que pueden contener
   * cualquier dato que el cliente haya decidido pedir. Fecha, estado y formulario quedan
   * intactos para que la analitica de asistencia siga siendo correcta.
   */
  async anonymizeReservation(reservationId: string, organizationId: string, reason = 'Retención expirada'): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOneBy({ id: reservationId, organizationId });
    if (!reservation) throw new NotFoundException('Reservation not found');

    reservation.guestName = `Visitante anonimizado ${reservation.id.slice(0, 8)}`;
    reservation.guestEmail = null;
    reservation.guestPhone = null;
    reservation.answers = {};
    reservation.internalNotes = null;
    reservation.fbc = null;
    reservation.fbp = null;
    reservation.clientIpAddress = null;
    reservation.clientUserAgent = null;

    const saved = await this.reservationRepo.save(reservation);
    await this.recordAnonymization(organizationId, 'Reservation', reservationId, reason);
    return saved;
  }

  /**
   * Anonimiza las reservas cuya fecha ya paso hace mas de `retentionDays`.
   *
   * El corte se hace sobre `startsAt` y no sobre la creacion: lo que agota la finalidad del
   * dato es que la visita ya ocurrio. Se omiten las ya anonimizadas para que el trabajo sea
   * idempotente, y un fallo puntual no detiene al resto del lote.
   *
   * @returns Cuantas reservas se revisaron y cuantas se anonimizaron.
   */
  async anonymizeExpiredReservations(retentionDays: number, reason = 'Retención expirada'): Promise<{ reviewed: number; anonymized: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const expired = await this.reservationRepo.find({ where: { startsAt: LessThan(cutoff) } });

    let anonymized = 0;
    for (const reservation of expired) {
      if (reservation.guestEmail === null && reservation.guestPhone === null && reservation.guestName.startsWith('Visitante anonimizado')) continue;
      try {
        await this.anonymizeReservation(reservation.id, reservation.organizationId, reason);
        anonymized += 1;
      } catch {
        // Un fallo puntual (por ejemplo una restriccion) no debe frenar el resto del lote.
      }
    }
    return { reviewed: expired.length, anonymized };
  }

  async recordConsent(userId: string, action: string, granted: boolean, ipAddress?: string): Promise<DataConsent> {
    const consent = this.consentRepo.create({ userId, action, granted, ipAddress });
    return this.consentRepo.save(consent);
  }
}
