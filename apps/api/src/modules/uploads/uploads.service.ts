import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Upload } from './upload.entity';
import { Integration } from '../integrations/integration.entity';
import { IntegrationProvider } from '../integrations/integration-provider.enum';
import { revealSecret } from '../../shared/security/integration-secrets';
import { GoogleOAuthService } from '../integrations/google/google-oauth.service';
import { validateFileContent } from './file-content-validator';

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Upload) private repo: Repository<Upload>,
    @InjectRepository(Integration) private integrations: Repository<Integration>,
    private readonly googleOAuth: GoogleOAuthService,
  ) {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(file: Express.Multer.File | undefined, organizationId: string, uploadedBy: string): Promise<Upload> {
    if (!file?.buffer?.length) throw new BadRequestException('Debes seleccionar un archivo válido');
    const { extension } = validateFileContent(file.mimetype, file.buffer);

    const fileName = `${uuidv4()}${extension}`;
    const filePath = path.join(this.uploadDir, fileName);
    await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      const upload = this.repo.create({
        organizationId,
        fileName,
        originalName: path.basename(file.originalname).slice(0, 255),
        mimeType: file.mimetype,
        size: file.buffer.length,
        path: filePath,
        uploadedBy,
      });
      return await this.repo.save(upload);
    } catch (error) {
      await fs.promises.rm(filePath, { force: true });
      throw error;
    }
  }

  async getFile(id: string, organizationId: string): Promise<Upload> {
    const upload = await this.repo.findOne({ where: { id, organizationId } });
    if (!upload) throw new NotFoundException('File not found');
    return upload;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const upload = await this.getFile(id, organizationId);
    await fs.promises.rm(upload.path, { force: true });
    await this.repo.remove(upload);
  }

  async syncToDrive(id: string, organizationId: string, folderId?: string): Promise<Upload> {
    const upload = await this.getFile(id, organizationId);
    if (upload.driveFileId) return upload;
    if (!fs.existsSync(upload.path)) throw new NotFoundException('El archivo local ya no está disponible');

    let integration = await this.integrations.findOne({ where: { organizationId, provider: IntegrationProvider.GOOGLE } });
    if (!integration) throw new BadRequestException('Google Drive no está conectado');
    const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
      integration = await this.googleOAuth.refreshIntegration(integration.id, organizationId);
    }
    const token = revealSecret(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    if (!token) throw new BadRequestException('Google Drive no está conectado');

    const boundary = `vitahub_${uuidv4().replace(/-/g, '')}`;
    const metadata = JSON.stringify({ name: upload.originalName, ...(folderId ? { parents: [folderId] } : {}) });
    const file = await fs.promises.readFile(upload.path);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${upload.mimeType}\r\n\r\n`),
      file,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok || !data.id) throw new BadRequestException(data.error?.message || `Google Drive upload failed (${response.status})`);
    upload.driveFileId = data.id;
    return this.repo.save(upload);
  }
}
