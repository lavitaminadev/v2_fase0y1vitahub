import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';
import { GetOpportunityUseCase } from './get-opportunity.use-case';

@Injectable()
export class UpdateOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly referenceValidator: OpportunityReferenceValidator,
    private readonly getOpportunity: GetOpportunityUseCase,
  ) {}

  async execute(id: string, dto: UpdateOpportunityDto, organizationId: string): Promise<Opportunity> {
    const opportunity = await this.getOpportunity.execute(id, organizationId);
    await this.referenceValidator.validate(dto, organizationId);
    Object.assign(opportunity, dto);
    if (dto.name !== undefined) opportunity.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.stage !== undefined) opportunity.stage = dto.stage.trim().toLowerCase();
    if (dto.expectedCloseDate !== undefined) opportunity.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined;
    if (dto.nextAction !== undefined) opportunity.nextAction = dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined;
    if (dto.nextActionAt !== undefined) opportunity.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : undefined;
    return this.repo.save(opportunity);
  }
}
