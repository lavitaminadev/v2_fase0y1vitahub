import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brief } from './brief.entity';
import { CreateBriefDto } from './dto/create-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { Client } from '../clients/client.entity';

/**
 * Business logic for briefs (client requirements documents).
 */
@Injectable()
export class BriefsService {
  constructor(
    @InjectRepository(Brief) private readonly repo: Repository<Brief>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  /**
   * Creates a brief scoped to an organization.
   *
   * @param dto - Brief creation data.
   * @param organizationId - Tenant id.
   * @returns Saved brief entity.
   */
  async create(dto: CreateBriefDto, organizationId: string): Promise<Brief> {
    const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    const brief = this.repo.create({
      ...dto,
      organizationId,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
    return this.repo.save(brief);
  }

  /**
   * Returns paginated briefs for the organization.
   *
   * @param organizationId - Tenant id.
   * @param limit - Page size.
   * @param offset - Items to skip.
   * @returns Paginated brief list.
   */
  async findAll(organizationId: string, limit = 50, offset = 0): Promise<{ data: Brief[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['client'],
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  /**
   * Finds a brief by id and tenant.
   *
   * @param id - Brief identifier.
   * @param organizationId - Tenant id.
   * @returns Brief entity.
   * @throws NotFoundException if not found.
   */
  async findOne(id: string, organizationId: string): Promise<Brief> {
    const brief = await this.repo.findOne({ where: { id, organizationId }, relations: ['client'] });
    if (!brief) throw new NotFoundException('Brief not found');
    return brief;
  }

  /**
   * Updates a brief.
   *
   * @param id - Brief identifier.
   * @param dto - Fields to update.
   * @param organizationId - Tenant id.
   * @returns Updated brief entity.
   */
  async update(id: string, dto: UpdateBriefDto, organizationId: string): Promise<Brief> {
    const brief = await this.findOne(id, organizationId);
    Object.assign(brief, dto);
    if (dto.title !== undefined) brief.title = dto.title.trim();
    if (dto.description !== undefined) brief.description = dto.description.trim() || undefined;
    if (dto.dueDate !== undefined) brief.dueDate = new Date(dto.dueDate);
    return this.repo.save(brief);
  }

  /**
   * Removes a brief.
   *
   * @param id - Brief identifier.
   * @param organizationId - Tenant id.
   * @returns Removed brief entity.
   */
  async remove(id: string, organizationId: string): Promise<Brief> {
    const brief = await this.findOne(id, organizationId);
    return this.repo.remove(brief);
  }
}
