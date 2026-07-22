import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { MetaPixelService } from './meta-pixel.service';

type ClientPixelRecord = { pixelId: string; pixelName?: string; accessToken?: string; configuredAt: string };

@Injectable()
export class MetaClientPixelService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly pixels: MetaPixelService,
  ) {}

  private async integration(id: string, organizationId: string) {
    const integration = await this.integrations.findOne({ where: { id, organizationId, provider: IntegrationProvider.META } });
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');
    return integration;
  }

  private async organizationIntegration(organizationId: string, create = false) {
    let integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.META },
      order: { createdAt: 'ASC' },
    });
    if (!integration && create) {
      integration = await this.integrations.save(this.integrations.create({
        organizationId,
        provider: IntegrationProvider.META,
        name: 'Meta CAPI',
        status: IntegrationStatus.PENDING,
        config: { directCapi: true, clientPixels: {} },
      }));
    }
    return integration;
  }

  private records(integration: Integration): Record<string, ClientPixelRecord> {
    const value = integration.config?.clientPixels;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, ClientPixelRecord> : {};
  }

  async list(id: string, organizationId: string) {
    const integration = await this.integration(id, organizationId);
    return this.catalogRows(organizationId, this.records(integration));
  }

  private async catalogRows(organizationId: string, records: Record<string, ClientPixelRecord>) {
    const clients = await this.clients.find({ where: { organizationId }, order: { name: 'ASC' } });
    return clients.map((client) => ({
      clientId: client.id,
      clientName: client.name,
      pixelId: records[client.id]?.pixelId || null,
      pixelName: records[client.id]?.pixelName || null,
      tokenConfigured: Boolean(records[client.id]?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
      configuredAt: records[client.id]?.configuredAt || null,
    }));
  }

  async catalog(organizationId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const records = integration ? this.records(integration) : {};
    const bindings = await this.catalogRows(organizationId, records);
    const pixels = Array.from(new Set(Object.values(records).map((record) => record.pixelId))).map((pixelId) => {
      const matched = bindings.filter((binding) => binding.pixelId === pixelId);
      const clients = matched.map((binding) => binding.clientName);
      const names = matched.map((binding) => binding.pixelName).filter(Boolean) as string[];
      const record = Object.values(records).find((item) => item.pixelId === pixelId);
      return {
        pixelId,
        clientNames: clients,
        pixelNames: names,
        usageCount: clients.length,
        tokenConfigured: Boolean(record?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
      };
    });
    return { bindings, pixels };
  }

  async configure(id: string, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const integration = await this.integration(id, organizationId);
    return this.configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName);
  }

  private async configureRecord(integration: Integration, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const existing = this.records(integration)[clientId];
    const token = accessToken?.trim() || revealSecret(existing?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN;
    if (!token) throw new BadRequestException('Se requiere un token CAPI para este cliente');
    if (!await this.pixels.validatePixel(pixelId, token)) throw new BadRequestException('Meta no reconoció el Pixel con el token entregado');
    const clientPixels = {
      ...this.records(integration),
      [clientId]: {
        pixelId,
        pixelName: pixelName?.trim() || existing?.pixelName || client.name,
        accessToken: accessToken?.trim() ? protectSecret(accessToken.trim()) : existing?.accessToken,
        configuredAt: new Date().toISOString(),
      },
    };
    integration.config = { ...integration.config, clientPixels };
    await this.integrations.save(integration);
    return { clientId, clientName: client.name, pixelId, pixelName: clientPixels[clientId].pixelName || client.name, tokenConfigured: true, configuredAt: clientPixels[clientId].configuredAt };
  }

  async setup(
    organizationId: string,
    clientId: string,
    mode: 'none' | 'manual' | 'existing',
    input: { pixelId?: string; existingPixelId?: string; pixelName?: string; accessToken?: string },
  ) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const integration = await this.organizationIntegration(organizationId, mode !== 'none');
    if (!integration) return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };

    const records = this.records(integration);
    if (mode === 'none') {
      delete records[clientId];
      integration.config = { ...integration.config, clientPixels: records };
      await this.integrations.save(integration);
      return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };
    }

    if (mode === 'existing') {
      const source = Object.values(records).find((record) => record.pixelId === input.existingPixelId);
      if (!source) throw new BadRequestException('El Pixel existente no está disponible en esta organización');
      const configuredAt = new Date().toISOString();
      records[clientId] = { ...source, pixelName: input.pixelName?.trim() || source.pixelName || client.name, configuredAt };
      integration.config = { ...integration.config, clientPixels: records };
      await this.integrations.save(integration);
      return { clientId, clientName: client.name, pixelId: source.pixelId, pixelName: records[clientId].pixelName || null, tokenConfigured: Boolean(source.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN), configuredAt };
    }

    if (!input.pixelId) throw new BadRequestException('Debes indicar el ID del Pixel');
    const result = await this.configureRecord(integration, organizationId, clientId, input.pixelId, input.accessToken, input.pixelName);
    if (input.pixelName?.trim()) {
      const updated = this.records(integration);
      updated[clientId] = { ...updated[clientId], pixelName: input.pixelName.trim() };
      integration.config = { ...integration.config, clientPixels: updated };
      await this.integrations.save(integration);
      return { ...result, pixelName: input.pixelName.trim() };
    }
    return { ...result, pixelName: result.clientName };
  }

  async resolve(organizationId: string, clientId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const record = integration ? this.records(integration)[clientId] : undefined;
    return {
      pixelId: record?.pixelId || '',
      pixelName: record?.pixelName || null,
      accessToken: process.env.META_CONVERSIONS_ACCESS_TOKEN || revealSecret(record?.accessToken),
    };
  }

  async resolveByPixel(organizationId: string, pixelId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const record = integration ? Object.values(this.records(integration)).find((item) => item.pixelId === pixelId) : undefined;
    return process.env.META_CONVERSIONS_ACCESS_TOKEN || revealSecret(record?.accessToken);
  }
}
