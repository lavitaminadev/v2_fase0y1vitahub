import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Invoice } from '../../../modules/billing/invoice.entity';
import { Client } from '../../../modules/clients/client.entity';
import { EmailService } from '../../notifications/email.service';

@Injectable()
export class CollectionEmailsJob {
  private readonly logger = new Logger(CollectionEmailsJob.name);

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private emailService: EmailService,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Processing overdue invoices...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = await this.invoiceRepo.find({
      where: { status: 'pending', dueAt: LessThan(today) },
      relations: ['client'],
    });

    let sent = 0;
    for (const invoice of overdueInvoices) {
      const client = invoice.client;
      if (!client) {
        this.logger.warn(`Invoice ${invoice.number} has no associated client, skipping`);
        continue;
      }

      const email = await this.resolveClientEmail(client.id);
      if (!email) {
        this.logger.warn(`Client ${client.id} has no email, skipping invoice ${invoice.number}`);
        continue;
      }

      const dueDateStr = invoice.dueAt instanceof Date
        ? invoice.dueAt.toISOString().split('T')[0]
        : String(invoice.dueAt);

      const delivered = await this.emailService.sendCollectionEmail(
        client.name,
        email,
        invoice.number,
        Number(invoice.total),
        dueDateStr,
      );

      invoice.status = 'overdue';
      await this.invoiceRepo.save(invoice);
      if (delivered) {
        sent++;
        this.logger.log(`Collection email accepted for invoice ${invoice.number}`);
      } else {
        this.logger.warn(`Collection email was not delivered for invoice ${invoice.number}`);
      }
    }

    this.logger.log(`Processed ${overdueInvoices.length} overdue invoices, sent ${sent} emails`);
  }

  private async resolveClientEmail(clientId: string): Promise<string | null> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['lead'],
    });
    return client?.lead?.email ?? null;
  }
}
