import { Injectable, Logger } from "@nestjs/common";
import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeStore } from "./knowledge.store";
import { randomUUID } from "node:crypto";

export interface RagSearchResult {
  content: string;
  sourceName: string;
  score: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly store: KnowledgeStore,
  ) {}

  async storeChunk(
    tenantId: string,
    content: string,
    embedding: number[],
    metadata: { sourceName: string; chunkIndex: number; tokenCount: number },
  ): Promise<void> {
    await this.store.add({
      id: randomUUID(),
      tenantId,
      content,
      embedding,
      sourceName: metadata.sourceName,
      chunkIndex: metadata.chunkIndex,
      tokenCount: metadata.tokenCount,
      createdAt: Date.now(),
    });
  }

  async semanticSearch(tenantId: string, query: string, limit = 5): Promise<RagSearchResult[]> {
    try {
      const queryEmbedding = await this.embeddings.create(query);
      const results = await this.store.search(tenantId, queryEmbedding, limit);
      return results.map((r) => ({ content: r.content, sourceName: r.sourceName, score: r.score }));
    } catch (error) {
      this.logger.warn(`Semantic search unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return [];
    }
  }

  async augmentPrompt(tenantId: string, userMessage: string, systemPrompt: string): Promise<string> {
    const relevantDocs = await this.semanticSearch(tenantId, userMessage, 5);
    if (relevantDocs.length === 0) return systemPrompt;
    const contextBlock = relevantDocs
      .map(
        (doc) =>
          `[${doc.sourceName}] (relevancia: ${(doc.score * 100).toFixed(0)}%)\n${doc.content}`,
      )
      .join("\n\n---\n\n");
    return `${systemPrompt}\n\n## Contexto recuperado\n${contextBlock}\n\nInstrucciones:
- Usa el contexto de arriba para responder si es relevante.
- Si el contexto no contiene la respuesta, dilo claramente.
- No inventes información que no esté en el contexto.
- Cita el nombre del documento fuente cuando uses información del contexto.`;
  }

  async deleteSource(tenantId: string, sourceName: string): Promise<void> {
    await this.store.deleteBySource(tenantId, sourceName);
  }

  async stats(tenantId: string) {
    return this.store.stats(tenantId);
  }
}
