import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';

/**
 * Shared lookup/token helpers used by both MetaOAuthService and MetaAssetDiscoveryService.
 */
@Injectable()
export class MetaIntegrationAccessor {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
  ) {}

  async requireIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.META },
    });
    if (!integration) throw new BadRequestException('Meta integration not found');
    return integration;
  }

  getAccessToken(integration: Integration): string {
    const stored = typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : '';
    const accessToken = revealSecret(stored) ?? '';
    if (!accessToken) throw new BadRequestException('Meta access token is missing');
    return accessToken;
  }
}
