import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { IntegrationProvider } from './integration-provider.enum';
import { assertConfigHasNoSecrets, toIntegrationResponse } from './integration-response';

@Injectable()
export class CreateIntegrationUseCase {
  constructor(
    @InjectRepository(Integration) private repo: Repository<Integration>,
  ) {}

  async execute(data: { organizationId: string; provider: IntegrationProvider; name: string; config?: Record<string, any> }) {
    assertConfigHasNoSecrets(data.config);
    const integration = this.repo.create({
      organizationId: data.organizationId,
      provider: data.provider,
      name: data.name,
      config: data.config,
    });
    return toIntegrationResponse(await this.repo.save(integration));
  }
}
