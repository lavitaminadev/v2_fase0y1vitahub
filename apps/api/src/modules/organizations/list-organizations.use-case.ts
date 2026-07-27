import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Lista la organización actual.
 */
@Injectable()
export class ListOrganizationsUseCase {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
  ) {}

  /**
   * Devuelve la organización seleccionada por el contexto de tenant autenticado.
   *
   * @returns Lista de entidades de organización.
   */
  async execute(organizationId: string): Promise<Organization[]> {
    return this.repo.find({
      where: { id: organizationId },
      order: { name: 'ASC' },
    });
  }
}
