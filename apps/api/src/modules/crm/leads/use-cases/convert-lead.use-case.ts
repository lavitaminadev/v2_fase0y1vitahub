import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus } from '../lead-status.enum';
import { Client } from '../../../clients/client.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientStatus } from '../../../clients/client-status.enum';

@Injectable()
export class ConvertLeadUseCase {
  constructor(
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(leadId: string, organizationId: string) {
    const result = await this.leadRepo.manager.transaction(async (manager: EntityManager) => {
      const lead = await manager.findOne(Lead, {
        where: { id: leadId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lead) throw new NotFoundException('Lead no encontrado');
      if (lead.status === LeadStatus.WON || lead.convertedToClientId) {
        throw new ConflictException('El lead ya fue convertido');
      }

      const client = manager.create(Client, {
        organizationId,
        name: lead.name,
        leadId: lead.id,
        status: ClientStatus.ONBOARDING,
      });
      const savedClient = await manager.save(Client, client);

      lead.status = LeadStatus.WON;
      lead.convertedAt = new Date();
      lead.convertedToClientId = savedClient.id;
      await manager.save(Lead, lead);

      return { lead, client: savedClient };
    });
    this.eventEmitter.emit('lead.converted', {
      organizationId,
      leadId: result.lead.id,
      clientId: result.client.id,
    });
    return result;
  }
}
