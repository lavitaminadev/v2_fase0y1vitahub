import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Lists the current organization.
 */
@Injectable()
export class ListOrganizationsUseCase {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
  ) {}

  /**
   * Returns the organization selected by the authenticated tenant context.
   *
   * @returns List of organization entities.
   */
  async execute(organizationId: string): Promise<Organization[]> {
    return this.repo.find({
      where: { id: organizationId },
      order: { name: 'ASC' },
    });
  }
}
