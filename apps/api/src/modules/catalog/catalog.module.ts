import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './service.entity';
import { Quote } from './quote.entity';
import { Pack } from './pack.entity';
import { CatalogController } from './catalog.controller';
import { QuotesService } from './quotes.service';
import { Client } from '../clients/client.entity';
import { Lead } from '../crm/leads/lead.entity';
import { Contract } from '../contracts/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Quote, Pack, Client, Lead, Contract])],
  controllers: [CatalogController],
  providers: [QuotesService],
})
export class CatalogModule {}
