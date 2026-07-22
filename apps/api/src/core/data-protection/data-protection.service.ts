import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';

@Injectable()
export class DataProtectionService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(DataConsent) private consentRepo: Repository<DataConsent>,
  ) {}

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
    lead.metadata = {
      retentionAnonymizedAt: new Date().toISOString(),
      retentionReason: reason,
      previousFitStatus: lead.fitStatus,
    };

    return this.leadRepo.save(lead);
  }

  async recordConsent(userId: string, action: string, granted: boolean, ipAddress?: string): Promise<DataConsent> {
    const consent = this.consentRepo.create({ userId, action, granted, ipAddress });
    return this.consentRepo.save(consent);
  }
}
