import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';
import { ClientCapabilities, normalizeClientCapabilities } from './client-capabilities';

@Injectable()
export class CreateClientUseCase {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Lead) private leads: Repository<Lead>,
  ) {}

  async execute(data: {
    organizationId: string;
    name: string;
    legalName?: string;
    industry?: string;
    communityManagerId?: string;
    leadId?: string;
    retainerAmount?: number;
    currency?: string;
    defaultUdBudget?: number;
    capabilities?: Partial<ClientCapabilities>;
  }) {
    if (data.communityManagerId) {
      const manager = await this.users.findOne({ where: { id: data.communityManagerId, organizationId: data.organizationId, isActive: true } });
      if (!manager || !['community_manager', 'operations_director'].includes(manager.role)) {
        throw new BadRequestException('El responsable debe ser una CM o dirección de operaciones activa');
      }
    }
    if (data.leadId) {
      const lead = await this.leads.findOne({ where: { id: data.leadId, organizationId: data.organizationId } });
      if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
    }
    const client = this.repo.create({ ...data, capabilities: normalizeClientCapabilities(data.capabilities) });
    return this.repo.save(client);
  }
}
