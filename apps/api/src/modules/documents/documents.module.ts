import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { GoogleDriveService } from './google-drive.service';
import { Client } from '../clients/client.entity';
import { Integration } from '../integrations/integration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Client, Integration])],
  controllers: [DocumentsController],
  providers: [DocumentsService, GoogleDriveService],
})
export class DocumentsModule {}
