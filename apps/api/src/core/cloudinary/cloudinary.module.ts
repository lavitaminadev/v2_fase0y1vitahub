import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryController } from './cloudinary.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from '../../modules/integrations/integration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Integration]), HttpModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
