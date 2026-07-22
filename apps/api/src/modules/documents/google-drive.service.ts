import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Integration } from '../integrations/integration.entity';
import { IntegrationProvider } from '../integrations/integration-provider.enum';
import { revealSecret } from '../../shared/security/integration-secrets';

const STANDARD_FOLDERS = ['00_BRIEF-Y-RECURSOS', '01_EDITABLES', '02_PARA-REVISION', '03_APROBADOS', '04_FINALES-ENTREGADOS'];

@Injectable()
export class GoogleDriveService {
  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
  ) {}

  async bootstrapClient(organizationId: string, clientId: string) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    const integration = await this.integrations.findOne({ where: { organizationId, provider: IntegrationProvider.GOOGLE } });
    const token = revealSecret(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    if (!token) throw new BadRequestException('Google Drive is not connected');

    const rootName = client.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rootId = client.driveFolderId ?? await this.ensureFolder(token, rootName);
    if (!client.driveFolderId) {
      client.driveFolderId = rootId;
      await this.clients.save(client);
    }
    const folders: Record<string, string> = {};
    for (const name of STANDARD_FOLDERS) folders[name] = await this.ensureFolder(token, name, rootId);
    return { rootId, rootUrl: `https://drive.google.com/drive/folders/${rootId}`, folders };
  }

  private async ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const clauses = [`name='${escaped}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false'];
    if (parentId) clauses.push(`'${parentId}' in parents`);
    const query = new URLSearchParams({ q: clauses.join(' and '), fields: 'files(id,name)', pageSize: '1' });
    const found = await this.driveFetch<{ files?: Array<{ id: string }> }>(token, `https://www.googleapis.com/drive/v3/files?${query}`);
    if (found.files?.[0]?.id) return found.files[0].id;
    const created = await this.driveFetch<{ id: string }>(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
    });
    return created.id;
  }

  private async driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new BadRequestException(`Google Drive request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}
