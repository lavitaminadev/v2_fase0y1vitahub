import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';

@Injectable()
export class CreateOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly referenceValidator: OpportunityReferenceValidator,
  ) {}

  async execute(dto: CreateOpportunityDto, organizationId: string): Promise<Opportunity> {
    await this.referenceValidator.validate(dto, organizationId);
    const opportunity = this.repo.create({
      ...dto,
      organizationId,
      name: dto.name.trim().replace(/\s+/g, ' '),
      stage: dto.stage?.trim().toLowerCase() || 'new',
      expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      nextAction: dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined,
      nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
    });
    return this.repo.save(opportunity);
  }
}
