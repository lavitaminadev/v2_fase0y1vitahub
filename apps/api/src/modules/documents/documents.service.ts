import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Document } from './document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Client } from '../clients/client.entity';

/**
 * Business logic for documents and file metadata.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly repo: Repository<Document>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  async create(dto: CreateDocumentDto, organizationId: string, userId: string): Promise<Document> {
    const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    const doc = this.repo.create({ ...dto, organizationId, uploadedBy: userId, name: dto.name.trim(), type: dto.type?.trim().toLowerCase() || 'other', tags: dto.tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean) });
    return this.repo.save(doc);
  }

  async findAll(organizationId: string, limit = 50, offset = 0, clientIds?: string[]): Promise<{ data: Document[]; total: number; limit: number; offset: number }> {
    const where: FindOptionsWhere<Document> = { organizationId };
    if (clientIds !== undefined) where.clientId = In(clientIds);
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string, clientIds?: string[]): Promise<Document> {
    if (clientIds?.length === 0) throw new NotFoundException('Document not found');
    const doc = await this.repo.findOne({
      where: { id, organizationId, ...(clientIds !== undefined ? { clientId: In(clientIds) } : {}) },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto, organizationId: string): Promise<Document> {
    const doc = await this.findOne(id, organizationId);
    if (dto.clientId) {
      const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
      if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    }
    Object.assign(doc, dto);
    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.type !== undefined) doc.type = dto.type.trim().toLowerCase();
    if (dto.tags !== undefined) doc.tags = dto.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    return this.repo.save(doc);
  }

  async remove(id: string, organizationId: string): Promise<Document> {
    const doc = await this.findOne(id, organizationId);
    return this.repo.remove(doc);
  }
}
