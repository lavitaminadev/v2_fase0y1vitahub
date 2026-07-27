import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brief } from './brief.entity';
import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';
import { Client } from '../clients/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Brief, Client])],
  controllers: [BriefsController],
  providers: [BriefsService],
})
export class BriefsModule {}
