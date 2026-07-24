import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @InjectRepository(Invoice) private readonly repo: Repository<Invoice>,
    private readonly accountAccess: AccountAccessService,
  ) {}

  async execute(dto: CreateInvoiceDto, organizationId: string, user: AuthenticatedRequest['user']): Promise<Invoice> {
    await this.accountAccess.assertClient(organizationId, user, dto.clientId);
    return this.repo.save(this.repo.create({ ...dto, organizationId }));
  }
}
