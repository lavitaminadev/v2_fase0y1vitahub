import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { DataProtectionService } from '../../data-protection/data-protection.service';

@Injectable()
export class PurgeExpiredLeadsJob {
  private readonly logger = new Logger(PurgeExpiredLeadsJob.name);

  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    private readonly dataProtection: DataProtectionService,
  ) {}

  async handle(): Promise<void> {
    const now = new Date();
    this.logger.log('Reviewing expired CRM leads for anonymization...');

    const expiredLeads = await this.leadRepo.find({
      where: {
        retentionReviewAt: LessThan(now),
        fitStatus: 'discarded',
      },
      order: { retentionReviewAt: 'ASC' },
      take: 200,
    });

    let anonymized = 0;

    for (const lead of expiredLeads) {
      if (lead.metadata?.retentionAnonymizedAt) continue;
      await this.dataProtection.anonymizeLead(lead.id, lead.organizationId, 'Retención expirada');
      anonymized += 1;
    }

    this.logger.log(`Expired leads reviewed: ${expiredLeads.length}, anonymized: ${anonymized}`);
  }
}
