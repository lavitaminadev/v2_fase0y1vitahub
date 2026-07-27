import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KnowledgeController } from "./knowledge.controller";
import { RagService } from "./rag.service";
import { KnowledgeStore } from "./knowledge.store";
import { KnowledgeChunk } from "./knowledge-chunk.entity";
import { ChunkerService } from "./chunker.service";
import { TextCleanerService } from "./text-cleaner.service";
import { DocumentParserService } from "./document-parser.service";
import { DocumentProcessorService } from "./document-processor.service";
import { EmbeddingsService } from "./embeddings.service";

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([KnowledgeChunk])],
  controllers: [KnowledgeController],
  providers: [
    RagService,
    KnowledgeStore,
    ChunkerService,
    TextCleanerService,
    DocumentParserService,
    DocumentProcessorService,
    EmbeddingsService,
  ],
  exports: [
    RagService,
    KnowledgeStore,
    DocumentProcessorService,
    DocumentParserService,
    EmbeddingsService,
  ],
})
export class KnowledgeModule {}
