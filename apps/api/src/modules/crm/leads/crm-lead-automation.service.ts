import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Contact } from '../contacts/contact.entity';
import { Opportunity } from '../opportunities/opportunity.entity';
import { Interaction } from '../interactions/interaction.entity';
import { User } from '../../users/user.entity';
import { UserRole } from '../../organizations/user-role.enum';
import { Lead } from './lead.entity';
import { LeadFitStatus } from './lead-fit-status.enum';

@Injectable()
export class CrmLeadAutomationService {
  constructor(
    @InjectRepository(Contact) private readonly contactsRepo: Repository<Contact>,
    @InjectRepository(Opportunity) private readonly opportunitiesRepo: Repository<Opportunity>,
    @InjectRepository(Interaction) private readonly interactionsRepo: Repository<Interaction>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  /** Orígenes cuyo lead describe a un comensal, no a una organización que pueda comprar VITAHUB. */
  private static readonly AUDIENCE_SOURCES = new Set(['vitahub_reservations']);

  async runForLead(lead: Lead, manager?: EntityManager): Promise<void> {
    // Una captura de audiencia que llegue por esta vía se atiende como tal aunque el llamador no
    // haya declarado el dominio: el origen basta para saber que no es una venta.
    if (this.isAudienceLead(lead)) {
      await this.ensureAudienceContact(lead, manager);
      return;
    }

    await this.ensureIntakeInteraction(lead, manager);

    if (lead.fitStatus === LeadFitStatus.DISCARDED) {
      await this.ensureDiscardInteraction(lead, manager);
      return;
    }

    if (lead.fitStatus !== LeadFitStatus.QUALIFIED) return;

    const ownerId = await this.resolveCommercialOwner(lead.organizationId, manager);
    if (ownerId && !lead.assignedTo) {
      lead.assignedTo = ownerId;
    }

    await this.ensureContact(lead, manager);
    await this.ensureOpportunity(lead, ownerId ?? lead.assignedTo, manager);
    await this.ensureQualifiedInteraction(lead, ownerId ?? lead.assignedTo, manager);
  }

  /**
   * Asegura el contacto de una persona que reservó.
   *
   * Se separa de `runForLead` porque la audiencia no atraviesa el embudo comercial: no genera
   * interacciones de prospección, no se asigna a un ejecutivo y no abre oportunidad. Además, el
   * contacto se crea siempre —no solo si el lead califica—, porque todo el que reserva forma
   * parte de la audiencia del local por definición.
   */
  async ensureAudienceContact(lead: Lead, manager?: EntityManager): Promise<void> {
    await this.ensureContact(lead, manager);
  }

  /** Indica si el lead describe a un comensal, según el origen con que fue capturado. */
  private isAudienceLead(lead: Lead): boolean {
    return Boolean(lead.source && CrmLeadAutomationService.AUDIENCE_SOURCES.has(lead.source));
  }

  private async ensureContact(lead: Lead, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Contact) ?? this.contactsRepo;
    const existing = await repo.findOne({ where: { organizationId: lead.organizationId, leadId: lead.id } });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        // El contacto hereda el cliente del lead: así la audiencia de cada local queda separada
        // de la de los demás. Los leads comerciales no tienen cliente y el contacto queda global.
        clientId: lead.clientId ?? undefined,
        name: lead.name,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        notes: lead.notes,
      }),
    );
  }

  private async ensureOpportunity(lead: Lead, ownerId?: string, manager?: EntityManager): Promise<void> {
    // Segunda barrera, deliberadamente redundante con `runForLead`: una oportunidad representa una
    // venta de VITAHUB a una empresa. Abrir una desde una reserva mete comensales en el forecast
    // comercial y se los asigna a un ejecutivo, así que el origen se verifica también acá.
    if (this.isAudienceLead(lead)) return;

    const repo = manager?.getRepository(Opportunity) ?? this.opportunitiesRepo;
    const existing = await repo.findOne({ where: { organizationId: lead.organizationId, leadId: lead.id } });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        name: lead.company || lead.name,
        stage: 'qualified',
        probability: 35,
        assignedTo: ownerId,
        expectedCloseDate: this.buildExpectedCloseDate(),
      }),
    );
  }

  private async ensureIntakeInteraction(lead: Lead, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Interaction) ?? this.interactionsRepo;
    const existing = await repo.findOne({
      where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_ingested' },
    });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        type: 'lead_ingested',
        description: `Lead ingresado desde ${lead.sourceDetail || lead.source || 'origen desconocido'}.`,
      }),
    );
  }

  private async ensureQualifiedInteraction(lead: Lead, ownerId?: string, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Interaction) ?? this.interactionsRepo;
    const existing = await repo.findOne({
      where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_qualified' },
    });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        type: 'lead_qualified',
        description: `Lead calificado automáticamente con score ${lead.qualityScore}.`,
        createdBy: ownerId,
      }),
    );
  }

  private async ensureDiscardInteraction(lead: Lead, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Interaction) ?? this.interactionsRepo;
    const existing = await repo.findOne({
      where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_discarded' },
    });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        type: 'lead_discarded',
        description: lead.discardReason || 'Lead descartado automáticamente por bajo encaje.',
      }),
    );
  }

  private async resolveCommercialOwner(organizationId: string, manager?: EntityManager): Promise<string | undefined> {
    const repo = manager?.getRepository(User) ?? this.usersRepo;
    const commercialDirector = await repo.findOne({
      where: { organizationId, role: UserRole.COMMERCIAL_DIRECTOR, isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (commercialDirector) return commercialDirector.id;

    const admin = await repo.findOne({
      where: { organizationId, role: UserRole.ADMIN, isActive: true },
      order: { createdAt: 'ASC' },
    });
    return admin?.id;
  }

  private buildExpectedCloseDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date;
  }
}
