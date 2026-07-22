import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Upload } from './upload.entity';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Integration } from '../integrations/integration.entity';
import { GoogleModule } from '../integrations/google/google.module';
import { CloudinaryModule } from '../../core/cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload, Integration]),
    MulterModule.register({ storage: memoryStorage(), limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024), files: 1 } }),
    OrganizationsModule,
    GoogleModule,
    CloudinaryModule,
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
