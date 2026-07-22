import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { IntegrationStatus } from './integration-status.enum';
import { assertConfigHasNoSecrets, toIntegrationResponse } from './integration-response';

@Injectable()
export class UpdateIntegrationUseCase {
  constructor(
    @InjectRepository(Integration) private repo: Repository<Integration>,
  ) {}

  async execute(id: string, data: { status?: IntegrationStatus; config?: Record<string, unknown> }, organizationId: string) {
    const integration = await this.repo.findOne({ where: { id, organizationId } });
    if (!integration) throw new NotFoundException('Integration not found');

    if (data.status) {
      integration.status = data.status;
    }
    if (data.config) {
      assertConfigHasNoSecrets(data.config);
      integration.config = data.config;
    }

    return toIntegrationResponse(await this.repo.save(integration));
  }
}
