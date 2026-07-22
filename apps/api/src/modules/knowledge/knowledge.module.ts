import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { KnowledgeController } from "./knowledge.controller";
import { RagService } from "./rag.service";
import { KnowledgeStore } from "./knowledge.store";
import { ChunkerService } from "./chunker.service";
import { TextCleanerService } from "./text-cleaner.service";
import { DocumentParserService } from "./document-parser.service";
import { DocumentProcessorService } from "./document-processor.service";
import { EmbeddingsService } from "./embeddings.service";

@Module({
  imports: [HttpModule],
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
