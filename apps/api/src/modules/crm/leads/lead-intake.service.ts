import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadFitStatus } from './lead-fit-status.enum';
import { CrmLeadAutomationService } from './crm-lead-automation.service';

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

export interface LeadCaptureInput {
  organizationId: string;
  clientId?: string;
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
  metadata?: Record<string, any>;
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

  async captureLead(input: LeadCaptureInput): Promise<Lead> {
    const normalized = this.normalizeInput(input);
    const transactionManager = this.repo.manager;

    if (!transactionManager?.transaction) {
      return this.captureLeadWithoutTransaction(normalized);
    }

    return transactionManager.transaction(async (manager) => {
      const leadsRepo = manager.getRepository(Lead);
      const existing = await this.findExistingLead(normalized, leadsRepo);
      const qualification = this.qualifyLead(normalized);
      const retentionReviewAt = this.buildRetentionReviewDate();

      const lead = existing ?? leadsRepo.create({ organizationId: normalized.organizationId });

      Object.assign(lead, {
        ...normalized,
        qualityScore: qualification.qualityScore,
        fitStatus: qualification.fitStatus,
        discardReason: qualification.discardReason,
        retentionReviewAt: normalized.retentionReviewAt ?? retentionReviewAt,
        metadata: {
          ...(existing?.metadata ?? {}),
          ...(normalized.metadata ?? {}),
          scoringSignals: qualification.scoringSignals,
        },
      });

      if (!lead.status) lead.status = 'new';
      const savedLead = await leadsRepo.save(lead);
      await this.automation.runForLead(savedLead, manager);
      return leadsRepo.save(savedLead);
    });
  }

  private async captureLeadWithoutTransaction(input: LeadCaptureInput & { retentionReviewAt?: Date }): Promise<Lead> {
    const existing = await this.findExistingLead(input);
    const qualification = this.qualifyLead(input);
    const retentionReviewAt = this.buildRetentionReviewDate();

    const lead = existing ?? this.repo.create({ organizationId: input.organizationId });

    Object.assign(lead, {
      ...input,
      qualityScore: qualification.qualityScore,
      fitStatus: qualification.fitStatus,
      discardReason: qualification.discardReason,
      retentionReviewAt: input.retentionReviewAt ?? retentionReviewAt,
      metadata: {
        ...(existing?.metadata ?? {}),
        ...(input.metadata ?? {}),
        scoringSignals: qualification.scoringSignals,
      },
    });

    if (!lead.status) lead.status = 'new';
    const savedLead = await this.repo.save(lead);
    await this.automation.runForLead(savedLead);
    return this.repo.save(savedLead);
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
    const where: any[] = [];
    const base: any = { organizationId };
    if (clientId) base.clientId = clientId;
    if (email) where.push({ ...base, email });
    if (phone) where.push({ ...base, phone });
    const lead = await this.repo.findOne({ where });
    if (!lead) return null;
    lead.status = status;
    return this.repo.save(lead);
  }

  private async findExistingLead(input: LeadCaptureInput, repo: Repository<Lead> = this.repo): Promise<Lead | null> {
    if (input.externalLeadId) {
      const byExternalId = await repo.findOne({
        where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId },
      });
      if (byExternalId) return byExternalId;
    }

    const baseWhere: any = { organizationId: input.organizationId };
    if (input.clientId) baseWhere.clientId = input.clientId;

    if (input.email) {
      const byEmail = await repo.findOne({ where: { ...baseWhere, email: input.email } });
      if (byEmail) return byEmail;
    }

    if (input.phone) {
      const byPhone = await repo.findOne({ where: { ...baseWhere, phone: input.phone } });
      if (byPhone) return byPhone;
    }

    return null;
  }

  private qualifyLead(input: LeadCaptureInput): LeadQualificationResult {
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
