import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { IntegrationAccount } from './integration-account.entity';
import { toIntegrationAccountResponse } from './integration-response';

@Injectable()
export class IntegrationAccountsService {
  constructor(
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  async assignClient(accountId: string, clientId: string | undefined, organizationId: string) {
    const account = await this.accounts.findOne({ where: { id: accountId }, relations: { integration: true } });
    if (!account || account.integration.organizationId !== organizationId) throw new NotFoundException('Account not found');
    if (!clientId) {
      const { clientId: _removed, ...metadata } = account.metadata ?? {};
      account.metadata = { ...metadata, selected: false };
      return toIntegrationAccountResponse(await this.accounts.save(account));
    }
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    account.metadata = { ...account.metadata, clientId: client.id, selected: true };
    return toIntegrationAccountResponse(await this.accounts.save(account));
  }
}
