import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brief } from './brief.entity';
import { CreateBriefDto } from './dto/create-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { Client } from '../clients/client.entity';

/**
 * Lógica de negocio para briefs (documentos de requerimientos del cliente).
 */
@Injectable()
export class BriefsService {
  constructor(
    @InjectRepository(Brief) private readonly repo: Repository<Brief>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  /**
   * Crea un brief acotado a una organización.
   *
   * @param dto - Datos de creación del brief.
   * @param organizationId - Id del tenant.
   * @returns Entidad del brief guardada.
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
   * Devuelve los briefs paginados de la organización.
   *
   * @param organizationId - Id del tenant.
   * @param limit - Tamaño de página.
   * @param offset - Items a saltar.
   * @returns Lista paginada de briefs.
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
   * Busca un brief por id y tenant.
   *
   * @param id - Identificador del brief.
   * @param organizationId - Id del tenant.
   * @returns Entidad del brief.
   * @throws NotFoundException si no se encuentra.
   */
  async findOne(id: string, organizationId: string): Promise<Brief> {
    const brief = await this.repo.findOne({ where: { id, organizationId }, relations: ['client'] });
    if (!brief) throw new NotFoundException('Brief not found');
    return brief;
  }

  /**
   * Actualiza un brief.
   *
   * @param id - Identificador del brief.
   * @param dto - Campos a actualizar.
   * @param organizationId - Id del tenant.
   * @returns Entidad del brief actualizada.
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
   * Elimina un brief.
   *
   * @param id - Identificador del brief.
   * @param organizationId - Id del tenant.
   * @returns Entidad del brief eliminada.
   */
  async remove(id: string, organizationId: string): Promise<Brief> {
    const brief = await this.findOne(id, organizationId);
    return this.repo.remove(brief);
  }
}
