import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

@Injectable()
export class UpdateLeadUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
  ) {}

  async execute(
    id: string,
    data: { status?: string; notes?: string; fitStatus?: string; discardReason?: string; tags?: string[] },
    organizationId: string,
  ) {
    const lead = await this.repo.findOne({ where: { id, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (data.status === LeadStatus.WON && !lead.convertedToClientId) {
      throw new BadRequestException('Para marcar un lead como ganado debes convertirlo en cliente');
    }
    if (data.status && Object.values(LeadStatus).includes(data.status as LeadStatus)) {
      lead.status = data.status as LeadStatus;
    }
    if (data.fitStatus && Object.values(LeadFitStatus).includes(data.fitStatus as LeadFitStatus)) {
      lead.fitStatus = data.fitStatus as LeadFitStatus;
    }
    if (data.notes !== undefined) lead.notes = data.notes;
    if (data.discardReason !== undefined) lead.discardReason = data.discardReason;
    if (data.tags !== undefined) lead.tags = data.tags;

    return this.repo.save(lead);
  }
}
