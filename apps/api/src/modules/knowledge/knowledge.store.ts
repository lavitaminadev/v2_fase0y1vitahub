import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KnowledgeChunk } from "./knowledge-chunk.entity";

export interface StoredChunk {
  id: string;
  tenantId: string;
  content: string;
  embedding: number[];
  sourceName: string;
  chunkIndex: number;
  tokenCount: number;
  createdAt: number;
}

function toStoredChunk(row: KnowledgeChunk): StoredChunk {
  return {
    id: row.id,
    tenantId: row.tenantId,
    content: row.content,
    embedding: row.embedding,
    sourceName: row.sourceName,
    chunkIndex: row.chunkIndex,
    tokenCount: row.tokenCount,
    createdAt: row.createdAt.getTime(),
  };
}

/**
 * Persiste chunks de la base de conocimiento en MySQL (antes vivian en un
 * `Map` en memoria y se perdian en cada deploy/reinicio — ver
 * docs/decisions/pending-business-decisions.md #16). La busqueda semantica
 * sigue calculando similitud coseno en la aplicacion, no en la base de
 * datos: el volumen de chunks por tenant es chico, asi que traer todos los
 * chunks del tenant y compararlos en memoria (igual que antes) sigue siendo
 * razonable sin necesitar un tipo vectorial nativo en MySQL.
 */
@Injectable()
export class KnowledgeStore {
  constructor(
    @InjectRepository(KnowledgeChunk) private readonly repo: Repository<KnowledgeChunk>,
  ) {}

  async add(chunk: Omit<StoredChunk, "createdAt"> & { createdAt?: number }): Promise<void> {
    await this.repo.save(this.repo.create({
      id: chunk.id,
      tenantId: chunk.tenantId,
      content: chunk.content,
      embedding: chunk.embedding,
      sourceName: chunk.sourceName,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
    }));
  }

  async get(id: string): Promise<StoredChunk | undefined> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toStoredChunk(row) : undefined;
  }

  async getByTenant(tenantId: string): Promise<StoredChunk[]> {
    const rows = await this.repo.find({ where: { tenantId }, order: { createdAt: "ASC" } });
    return rows.map(toStoredChunk);
  }

  async search(tenantId: string, queryEmbedding: number[], limit: number): Promise<Array<StoredChunk & { score: number }>> {
    const tenantChunks = await this.getByTenant(tenantId);
    const scored = tenantChunks.map((chunk) => ({
      ...chunk,
      score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async deleteBySource(tenantId: string, sourceName: string): Promise<void> {
    await this.repo.delete({ tenantId, sourceName });
  }

  async deleteAll(tenantId: string): Promise<void> {
    await this.repo.delete({ tenantId });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  async stats(tenantId: string): Promise<{ totalChunks: number; totalSources: number }> {
    const chunks = await this.getByTenant(tenantId);
    return { totalChunks: chunks.length, totalSources: new Set(chunks.map((chunk) => chunk.sourceName)).size };
  }
}
