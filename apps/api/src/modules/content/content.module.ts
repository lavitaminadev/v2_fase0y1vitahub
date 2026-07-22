import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentGrid } from './content-grid.entity';
import { ContentItem } from './content-item.entity';
import { ContentController } from './content.controller';
import { CreateContentGridUseCase } from './create-content-grid.use-case';
import { ListContentGridsUseCase } from './list-content-grids.use-case';
import { Client } from '../clients/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentGrid, ContentItem, Client])],
  controllers: [ContentController],
  providers: [CreateContentGridUseCase, ListContentGridsUseCase],
})
export class ContentModule {}
