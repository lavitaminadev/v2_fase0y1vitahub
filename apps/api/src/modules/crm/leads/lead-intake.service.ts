import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadFitStatus } from './lead-fit-status.enum';
import { CrmLeadAutomationService } from './crm-lead-automation.service';
import { Contact } from '../contacts/contact.entity';

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'yahoo.com',
  'live.com',
]);

const HIGH_INTENT_KEYWORDS = [
  'presupuesto',
  'cotizacion',
  'cotización',
  'reunion',
  'reunión',
  'agendar',
  'campana',
  'campaña',
  'marketing',
  'publicidad',
  'ads',
  'ventas',
  'clientes',
  'reserva',
  'restaurante',
  'clinica',
  'clínica',
];

const LOW_QUALITY_KEYWORDS = [
  'trabajo',
  'empleo',
  'practica',
  'práctica',
  'curriculum',
  'currículum',
  'proveedor',
  'factura',
  'spam',
  'prueba',
  'test',
  'soporte',
];

interface LeadMetadata {
  scoringSignals?: string[];
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | Record<string, unknown>[] | undefined;
}

/**
 * Dominio al que pertenece la captura.
 *
 * `commercial` es una organización que puede convertirse en cliente de VITAHUB: se le aplica
 * el scoring comercial y, si califica, la automatización que abre contacto y oportunidad.
 *
 * `audience` es una persona que reservó en el local de un cliente. Nunca es una venta, así que
 * no se le aplica scoring comercial ni se le abre oportunidad; solo se asegura su contacto.
 */
export type LeadDomain = 'commercial' | 'audience';

export interface LeadCaptureInput {
  organizationId: string;
  clientId?: string;
  /** Dominio de la captura. Por defecto `commercial`, que preserva el comportamiento previo. */
  domain?: LeadDomain;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  sourceDetail?: string;
  notes?: string;
  externalLeadId?: string;
  externalFormId?: string;
  externalCampaignId?: string;
  campaignName?: string;
  pageId?: string;
  status?: string;
  tags?: string[];
  consentCapturedAt?: Date;
  metadata?: LeadMetadata;
}

interface LeadQualificationResult {
  qualityScore: number;
  fitStatus: LeadFitStatus;
  discardReason?: string;
  scoringSignals: string[];
}

@Injectable()
export class LeadIntakeService {
  constructor(
    @InjectRepository(Lead) private readonly repo: Repository<Lead>,
    private readonly automation: CrmLeadAutomationService,
  ) {}

  /**
   * Captura a una persona que reservó y devuelve su contacto de audiencia.
   *
   * La reserva guarda el identificador del contacto para no tener que reconstruir el vínculo
   * cruzando teléfonos más adelante.
   */
  async captureAudience(input: Omit<LeadCaptureInput, 'domain'>): Promise<{ lead: Lead; contact: Contact | null }> {
    return this.capture({ ...input, domain: 'audience' });
  }

  /**
   * Captura una persona u organización y devuelve el lead resultante.
   *
   * Se conserva por compatibilidad con quienes solo necesitan el lead.
   */
  async captureLead(input: LeadCaptureInput): Promise<Lead> {
    const { lead } = await this.capture(input);
    return lead;
  }

  /**
   * Implementación común. Devuelve también el contacto para que el llamador pueda vincularlo,
   * en vez de exponerlo en un campo compartido del servicio: dos reservas simultáneas se
   * pisarían ese campo entre los `await` de la transacción.
   */
  private async capture(input: LeadCaptureInput): Promise<{ lead: Lead; contact: Contact | null }> {
    const { domain, payload } = this.splitDomain(input);
    const normalized = this.normalizeInput(payload);
    const transactionManager = this.repo.manager;

    if (!transactionManager?.transaction) {
      return this.captureLeadWithoutTransaction(normalized, domain);
    }

    return transactionManager.transaction(async (manager) => {
      const leadsRepo = manager.getRepository(Lead);
      const match = await this.findExistingLead(normalized, leadsRepo, domain);
      const qualification = this.qualifyLead(normalized, domain);
      const retentionReviewAt = this.buildRetentionReviewDate();

      const lead = match.lead ?? leadsRepo.create({ organizationId: normalized.organizationId });

      Object.assign(lead, {
        ...normalized,
        // El dominio se fija al crear el lead y no cambia en updates posteriores: una
        // captura de otro origen no debe poder mover un lead entre embudos silenciosamente.
        domain: match.lead?.domain ?? domain,
        qualityScore: qualification.qualityScore,
        fitStatus: qualification.fitStatus,
        discardReason: qualification.discardReason,
        retentionReviewAt: normalized.retentionReviewAt ?? retentionReviewAt,
        metadata: {
          ...(match.lead?.metadata ?? {}),
          ...(normalized.metadata ?? {}),
          scoringSignals: qualification.scoringSignals,
          ...(match.conflict ? { identityConflict: { ...match.conflict, detectedAt: new Date().toISOString() } } : {}),
        },
      });

      if (!lead.status) lead.status = 'new';
      const savedLead = await leadsRepo.save(lead);
      const contact = await this.runAutomation(savedLead, domain, manager);
      return { lead: await leadsRepo.save(savedLead), contact };
    });
  }

  private async captureLeadWithoutTransaction(
    input: LeadCaptureInput & { retentionReviewAt?: Date },
    domain: LeadDomain,
  ): Promise<{ lead: Lead; contact: Contact | null }> {
    const match = await this.findExistingLead(input, this.repo, domain);
    const qualification = this.qualifyLead(input, domain);
    const retentionReviewAt = this.buildRetentionReviewDate();

    const lead = match.lead ?? this.repo.create({ organizationId: input.organizationId });

    Object.assign(lead, {
      ...input,
      domain: match.lead?.domain ?? domain,
      qualityScore: qualification.qualityScore,
      fitStatus: qualification.fitStatus,
      discardReason: qualification.discardReason,
      retentionReviewAt: input.retentionReviewAt ?? retentionReviewAt,
      metadata: {
        ...(match.lead?.metadata ?? {}),
        ...(input.metadata ?? {}),
        scoringSignals: qualification.scoringSignals,
        ...(match.conflict ? { identityConflict: { ...match.conflict, detectedAt: new Date().toISOString() } } : {}),
      },
    });

    if (!lead.status) lead.status = 'new';
    const savedLead = await this.repo.save(lead);
    const contact = await this.runAutomation(savedLead, domain);
    return { lead: await this.repo.save(savedLead), contact };
  }

  /**
   * Separa el dominio del resto del payload.
   *
   * `domain` decide qué automatización corre y además se persiste en `leads.domain`
   * (migración 0069) — se separa acá solo para no depender del orden de propiedades del
   * spread al armar el `Object.assign` de la entidad más abajo.
   */
  private splitDomain(input: LeadCaptureInput): { domain: LeadDomain; payload: LeadCaptureInput } {
    const { domain = 'commercial', ...payload } = input;
    return { domain, payload };
  }

  /**
   * Ejecuta la automatización que corresponde al dominio de la captura.
   *
   * Una reserva no es una venta: para `audience` solo se asegura el contacto, sin abrir
   * oportunidad ni asignar responsable comercial.
   */
  private async runAutomation(lead: Lead, domain: LeadDomain, manager?: EntityManager): Promise<Contact | null> {
    if (domain === 'audience') {
      return this.automation.ensureAudienceContact(lead, manager);
    }
    await this.automation.runForLead(lead, manager);
    return null;
  }

  private normalizeInput(input: LeadCaptureInput): LeadCaptureInput & { retentionReviewAt?: Date } {
    return {
      ...input,
      name: input.name.trim().replace(/\s+/g, ' '),
      email: input.email?.trim().toLowerCase() || undefined,
      phone: input.phone?.replace(/[^\d+]/g, '') || undefined,
      company: input.company?.trim().replace(/\s+/g, ' ') || undefined,
      source: input.source?.trim().toLowerCase().replace(/\s+/g, '_') || undefined,
      sourceDetail: input.sourceDetail?.trim().replace(/\s+/g, ' ') || undefined,
      campaignName: input.campaignName?.trim().replace(/\s+/g, ' ') || undefined,
      notes: input.notes?.trim() || undefined,
    };
  }

  async updateStatusByContact(organizationId: string, status: string, email?: string | null, phone?: string | null, clientId?: string): Promise<Lead | null> {
    if (!email && !phone) return null;
    const conditions: FindOptionsWhere<Lead>[] = [];
    const base: FindOptionsWhere<Lead> = { organizationId };
    if (clientId) base.clientId = clientId;
    if (email) conditions.push({ ...base, email });
    if (phone) conditions.push({ ...base, phone });
    const lead = await this.repo.findOne({ where: conditions });
    if (!lead) return null;
    lead.status = status;
    return this.repo.save(lead);
  }

  /**
   * Busca una captura previa de la misma persona.
   *
   * El orden de las señales depende del dominio. Para audiencia el teléfono manda: es obligatorio
   * en la reserva, casi siempre único por persona, y el correo suele ser opcional o compartido
   * —una familia que reserva con la casilla de uno solo generaría contactos falsamente distintos
   * si el correo decidiera primero. Para el dominio comercial el correo sigue mandando, porque
   * identifica a la persona dentro de la empresa.
   *
   * La búsqueda queda acotada al cliente cuando hay uno: el mismo teléfono en dos restaurantes
   * son dos personas distintas a efectos de datos, y deben quedar separadas.
   */
  /**
   * Busca un lead existente por teléfono/email, sin fusionar automáticamente ante ambigüedad.
   *
   * Si teléfono y correo apuntan a leads DISTINTOS, no hay forma segura de saber cuál es el
   * correcto — fusionar el que llegue primero sobrescribiría datos de una persona con los de
   * otra. En ese caso se trata como "sin coincidencia segura" (se crea un lead nuevo) y se deja
   * la ambigüedad registrada en `metadata.identityConflict` para revisión manual, en vez de
   * adivinar.
   */
  private async findExistingLead(
    input: LeadCaptureInput,
    repo: Repository<Lead> = this.repo,
    domain: LeadDomain = 'commercial',
  ): Promise<{ lead: Lead | null; matchedBy?: 'externalLeadId' | 'phone' | 'email'; conflict?: { otherLeadId: string; otherMatchedBy: 'phone' | 'email' } }> {
    if (input.externalLeadId) {
      const byExternalId = await repo.findOne({
        where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId },
      });
      if (byExternalId) return { lead: byExternalId, matchedBy: 'externalLeadId' };
    }

    const baseWhere: FindOptionsWhere<Lead> = { organizationId: input.organizationId };
    if (input.clientId) baseWhere.clientId = input.clientId;

    const [byPhone, byEmail] = await Promise.all([
      input.phone ? repo.findOne({ where: { ...baseWhere, phone: input.phone } }) : Promise.resolve(null),
      input.email ? repo.findOne({ where: { ...baseWhere, email: input.email } }) : Promise.resolve(null),
    ]);

    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      return {
        lead: null,
        conflict: { otherLeadId: (domain === 'audience' ? byEmail : byPhone).id, otherMatchedBy: domain === 'audience' ? 'email' : 'phone' },
      };
    }

    if (domain === 'audience') {
      if (byPhone) return { lead: byPhone, matchedBy: 'phone' };
      if (byEmail) return { lead: byEmail, matchedBy: 'email' };
    } else {
      if (byEmail) return { lead: byEmail, matchedBy: 'email' };
      if (byPhone) return { lead: byPhone, matchedBy: 'phone' };
    }

    return { lead: null };
  }

  private qualifyLead(input: LeadCaptureInput, domain: LeadDomain = 'commercial'): LeadQualificationResult {
    // El scoring mide encaje comercial: correo corporativo, empresa, intención de compra. Aplicado
    // a un comensal no significa nada —reservar una mesa con Gmail no es una señal de baja calidad—
    // así que la audiencia no se puntúa y queda siempre en revisión, fuera de toda priorización.
    if (domain === 'audience') {
      return { qualityScore: 0, fitStatus: LeadFitStatus.REVIEW, scoringSignals: ['audience'] };
    }

    let qualityScore = 0;
    const signals: string[] = [];
    const haystack = [
      input.sourceDetail,
      input.campaignName,
      input.company,
      input.notes,
      JSON.stringify(input.metadata ?? {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (input.email) {
      qualityScore += 20;
      signals.push('email');
    }

    if (input.phone) {
      qualityScore += 25;
      signals.push('phone');
    }

    if (input.company) {
      qualityScore += 15;
      signals.push('company');
    }

    if (input.email && !this.isGenericEmail(input.email)) {
      qualityScore += 10;
      signals.push('work_email');
    }

    if (input.source === 'meta_lead_ads') {
      qualityScore += 10;
      signals.push('meta_source');
    }

    if (input.externalCampaignId || input.campaignName) {
      qualityScore += 5;
      signals.push('campaign_context');
    }

    const highIntentHits = HIGH_INTENT_KEYWORDS.filter((keyword) => haystack.includes(keyword));
    qualityScore += highIntentHits.length * 6;
    if (highIntentHits.length > 0) signals.push(`high_intent:${highIntentHits.slice(0, 3).join(',')}`);

    const lowQualityHits = LOW_QUALITY_KEYWORDS.filter((keyword) => haystack.includes(keyword));
    if (lowQualityHits.length > 0) {
      return {
        qualityScore: Math.max(qualityScore - 30, 0),
        fitStatus: LeadFitStatus.DISCARDED,
        discardReason: `Se detectaron señales de bajo encaje: ${lowQualityHits.slice(0, 3).join(', ')}`,
        scoringSignals: [...signals, `low_quality:${lowQualityHits.slice(0, 3).join(',')}`],
      };
    }

    if (!input.email && !input.phone) {
      return {
        qualityScore,
        fitStatus: LeadFitStatus.DISCARDED,
        discardReason: 'No dejó email ni teléfono para contacto comercial.',
        scoringSignals: [...signals, 'missing_contact_channel'],
      };
    }

    if (qualityScore >= 70) {
      return { qualityScore, fitStatus: LeadFitStatus.QUALIFIED, scoringSignals: signals };
    }

    if (qualityScore >= 35) {
      return { qualityScore, fitStatus: LeadFitStatus.REVIEW, scoringSignals: signals };
    }

    return {
      qualityScore,
      fitStatus: LeadFitStatus.DISCARDED,
      discardReason: 'Puntaje insuficiente para priorización comercial.',
      scoringSignals: [...signals, 'low_score'],
    };
  }

  private isGenericEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return Boolean(domain && GENERIC_EMAIL_DOMAINS.has(domain));
  }

  private buildRetentionReviewDate(): Date | undefined {
    const retentionDays = Number(process.env.CRM_LEAD_RETENTION_DAYS ?? '');
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return undefined;
    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }
}
