import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';

interface OpportunityReferences {
  leadId?: string | null;
  clientId?: string | null;
  assignedTo?: string;
}

@Injectable()
export class OpportunityReferenceValidator {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async validate(dto: OpportunityReferences, organizationId: string): Promise<void> {
    const checks: Promise<unknown>[] = [];
    if (dto.leadId) checks.push(this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } })
      .then((lead) => { if (!lead) throw new BadRequestException('El lead no pertenece a esta organización'); }));
    if (dto.clientId) checks.push(this.clients.findOne({ where: { id: dto.clientId, organizationId }, select: { id: true } })
      .then((client) => { if (!client) throw new BadRequestException('El cliente no pertenece a esta organización'); }));
    if (dto.assignedTo) checks.push(this.users.findOne({ where: { id: dto.assignedTo, organizationId, isActive: true }, select: { id: true } })
      .then((user) => { if (!user) throw new BadRequestException('El responsable no pertenece a esta organización o está inactivo'); }));
    await Promise.all(checks);
  }
}
