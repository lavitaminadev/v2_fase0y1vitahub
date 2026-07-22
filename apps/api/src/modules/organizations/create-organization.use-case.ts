import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Input required to create an organization.
 */
interface CreateOrganizationInput {
  name: string;
  code: string;
  currency?: string;
}

/**
 * Creates and updates organization records.
 */
@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
  ) {}

  /**
   * Persists a new organization.
   *
   * @param data - Organization creation input.
   * @returns Saved organization entity.
   */
  async execute(data: CreateOrganizationInput): Promise<Organization> {
    const org = this.repo.create(data);
    return this.repo.save(org);
  }

  /**
   * Updates an existing organization by id.
   *
   * @param id - Organization identifier.
   * @param data - Fields to update.
   * @returns Updated organization or null.
   */
  async executeUpdate(id: string, data: { name?: string; currency?: string }): Promise<Organization | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
}
