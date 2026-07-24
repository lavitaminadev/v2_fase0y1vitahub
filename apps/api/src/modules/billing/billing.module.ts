import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { BillingController } from './billing.controller';
import { ChargeNote } from './charge-note.entity';
import { BillingService } from './billing.service';
import { CreateInvoiceUseCase } from './use-cases/create-invoice.use-case';
import { ListInvoicesUseCase } from './use-cases/list-invoices.use-case';
import { ListChargeNotesUseCase } from './use-cases/list-charge-notes.use-case';
import { PriceChargeNoteUseCase } from './use-cases/price-charge-note.use-case';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, ChargeNote]), AccountAccessModule],
  controllers: [BillingController],
  providers: [BillingService, CreateInvoiceUseCase, ListInvoicesUseCase, ListChargeNotesUseCase, PriceChargeNoteUseCase],
  exports: [BillingService],
})
export class BillingModule {}
