import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Datos requeridos para crear una organización.
 */
interface CreateOrganizationInput {
  name: string;
  code: string;
  currency?: string;
}

/**
 * Crea y actualiza registros de organización.
 */
@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
  ) {}

  /**
   * Persiste una nueva organización.
   *
   * @param data - Datos de creación de la organización.
   * @returns Entidad de la organización guardada.
   */
  async execute(data: CreateOrganizationInput): Promise<Organization> {
    const org = this.repo.create(data);
    return this.repo.save(org);
  }

  /**
   * Actualiza una organización existente por id.
   *
   * @param id - Identificador de la organización.
   * @param data - Campos a actualizar.
   * @returns Organización actualizada o null.
   */
  async executeUpdate(id: string, data: { name?: string; currency?: string }): Promise<Organization | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
}
