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

  async runForLead(lead: Lead, manager?: EntityManager): Promise<void> {
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

  private async ensureContact(lead: Lead, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Contact) ?? this.contactsRepo;
    const existing = await repo.findOne({ where: { organizationId: lead.organizationId, leadId: lead.id } });
    if (existing) return;

    await repo.save(
      repo.create({
        organizationId: lead.organizationId,
        leadId: lead.id,
        name: lead.name,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        notes: lead.notes,
      }),
    );
  }

  private async ensureOpportunity(lead: Lead, ownerId?: string, manager?: EntityManager): Promise<void> {
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
