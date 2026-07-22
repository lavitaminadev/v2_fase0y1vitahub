import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { BillingController } from './billing.controller';
import { ChargeNote } from './charge-note.entity';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, ChargeNote])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
