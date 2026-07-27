import { Module } from '@nestjs/common';
import { ReportingController } from './reports.controller';
import { VitaminaPulseService } from './vitamina-pulse.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyReport } from './monthly-report.entity';
import { Client } from '../clients/client.entity';
import { MonthlyReportsService } from './monthly-reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([MonthlyReport, Client])],
  controllers: [ReportingController],
  providers: [VitaminaPulseService, MonthlyReportsService],
})
export class ReportsModule {}
