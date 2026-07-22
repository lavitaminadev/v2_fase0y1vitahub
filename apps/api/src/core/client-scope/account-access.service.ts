import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../shared/types/request';
import { Client } from '../../modules/clients/client.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';

@Injectable()
export class AccountAccessService {
  constructor(@InjectRepository(Client) private readonly clients: Repository<Client>) {}

  async allowedClientIds(organizationId: string, user: AuthUser): Promise<string[] | undefined> {
    if (user.role === UserRole.CLIENT) return user.clientId ? [user.clientId] : [];
    if (user.role !== UserRole.COMMUNITY_MANAGER) return undefined;
    const clients = await this.clients.find({
      select: { id: true },
      where: { organizationId, communityManagerId: user.id },
    });
    return clients.map((client) => client.id);
  }

  async assertClient(organizationId: string, user: AuthUser, clientId?: string): Promise<void> {
    if (!clientId) return;
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    if (user.role === UserRole.CLIENT && user.clientId !== client.id) throw new NotFoundException('Client not found');
    if (user.role === UserRole.COMMUNITY_MANAGER && client.communityManagerId !== user.id) {
      throw new NotFoundException('Client not found');
    }
  }
}
