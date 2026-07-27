import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { toIntegrationResponse } from './integration-response';

@Injectable()
export class ListIntegrationsUseCase {
  constructor(
    @InjectRepository(Integration) private repo: Repository<Integration>,
  ) {}

  async execute(organizationId: string, provider?: string) {
    const where: any = { organizationId };
    if (provider) where.provider = provider;
    const integrations = await this.repo.find({ where, order: { name: 'ASC' } });
    return integrations.map(toIntegrationResponse);
  }
}
