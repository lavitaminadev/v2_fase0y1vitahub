import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { Integration } from '../../modules/integrations/integration.entity';
import { IntegrationProvider } from '../../modules/integrations/integration-provider.enum';
import { revealSecret } from '../../shared/security/integration-secrets';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface CloudinaryApiResponse {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

function toSignString(params: Record<string, string | number>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    private readonly http: HttpService,
  ) {}

  private envCredentials(): CloudinaryCredentials | undefined {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (cloudName && apiKey && apiSecret) {
      return { cloudName, apiKey, apiSecret };
    }
    return undefined;
  }

  async getCredentials(organizationId?: string): Promise<CloudinaryCredentials | undefined> {
    const env = this.envCredentials();
    if (!organizationId) return env;

    const integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.CLOUDINARY },
    });
    if (integration?.config?.cloudName && integration.config?.apiKey) {
      return {
        cloudName: String(integration.config.cloudName),
        apiKey: String(integration.config.apiKey),
        apiSecret: revealSecret(integration.config.apiSecret) || env?.apiSecret || '',
      };
    }
    return env;
  }

  async isEnabled(organizationId?: string): Promise<boolean> {
    const credentials = await this.getCredentials(organizationId);
    return Boolean(credentials?.cloudName && credentials?.apiKey && credentials?.apiSecret);
  }

  async validateCredentials(credentials: CloudinaryCredentials): Promise<void> {
    try {
      await firstValueFrom(this.http.get(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/resources/image`,
        {
          params: { max_results: 1 },
          auth: { username: credentials.apiKey, password: credentials.apiSecret },
          timeout: 15000,
        },
      ));
    } catch (error: any) {
      this.logger.warn('Cloudinary credential validation failed', error?.response?.data || error?.message);
      throw new BadRequestException(error?.response?.data?.error?.message || 'Cloudinary rechazó las credenciales');
    }
  }

  async uploadImage(
    buffer: Buffer,
    organizationId: string,
    options: { folder?: string; fileName?: string; tags?: string[]; mimeType?: string } = {},
  ): Promise<CloudinaryUploadResult> {
    const credentials = await this.getCredentials(organizationId);
    if (!credentials?.cloudName || !credentials?.apiKey || !credentials?.apiSecret) {
      throw new BadRequestException('Cloudinary no está configurado para esta organización');
    }

    const folder = options.folder || 'vitahub';
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { timestamp, folder, overwrite: 'true' };
    if (options.fileName) {
      const cleanName = options.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      params.public_id = `${folder}/${cleanName}`;
      delete params.folder; // public_id ya incluye folder
    }
    if (options.tags?.length) {
      params.tags = options.tags.join(',');
    }

    const signature = sha1(`${toSignString(params)}${credentials.apiSecret}`);

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: options.mimeType || 'application/octet-stream' }));
    form.append('api_key', credentials.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'timestamp') form.append(key, String(value));
    });

    try {
      const { data } = await firstValueFrom(
        this.http.post<CloudinaryApiResponse>(
          `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`,
          form,
          { timeout: 30000 },
        ),
      );
      return {
        url: data.url,
        secureUrl: data.secure_url,
        publicId: data.public_id,
        format: data.format,
        bytes: data.bytes,
        width: data.width,
        height: data.height,
      };
    } catch (error: any) {
      this.logger.error('Cloudinary upload failed', error?.response?.data || error?.message);
      throw new BadRequestException(error?.response?.data?.error?.message || 'No se pudo subir la imagen a Cloudinary');
    }
  }

  async destroy(publicId: string, organizationId: string): Promise<void> {
    const credentials = await this.getCredentials(organizationId);
    if (!credentials?.cloudName || !credentials?.apiKey || !credentials?.apiSecret) return;
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { public_id: publicId, timestamp };
    const signature = sha1(`${toSignString(params)}${credentials.apiSecret}`);

    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', credentials.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    try {
      await firstValueFrom(
        this.http.post(
          `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/destroy`,
          form,
          { timeout: 15000 },
        ),
      );
    } catch (error: any) {
      this.logger.warn('Cloudinary destroy failed', error?.response?.data || error?.message);
    }
  }

}
