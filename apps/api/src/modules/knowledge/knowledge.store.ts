import { Injectable } from "@nestjs/common";

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

@Injectable()
export class KnowledgeStore {
  private chunks: Map<string, StoredChunk> = new Map();
  private tenantChunks: Map<string, string[]> = new Map();

  add(chunk: StoredChunk): void {
    this.chunks.set(chunk.id, chunk);
    const existing = this.tenantChunks.get(chunk.tenantId) || [];
    existing.push(chunk.id);
    this.tenantChunks.set(chunk.tenantId, existing);
  }

  get(id: string): StoredChunk | undefined {
    return this.chunks.get(id);
  }

  getByTenant(tenantId: string): StoredChunk[] {
    const ids = this.tenantChunks.get(tenantId) || [];
    return ids.map((id) => this.chunks.get(id)).filter(Boolean) as StoredChunk[];
  }

  search(tenantId: string, queryEmbedding: number[], limit: number): Array<StoredChunk & { score: number }> {
    const tenantChunks = this.getByTenant(tenantId);
    const scored = tenantChunks.map((chunk) => ({
      ...chunk,
      score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  deleteBySource(tenantId: string, sourceName: string): void {
    const ids = this.tenantChunks.get(tenantId) || [];
    const remaining = ids.filter((id) => {
      const chunk = this.chunks.get(id);
      if (chunk?.sourceName === sourceName) {
        this.chunks.delete(id);
        return false;
      }
      return true;
    });
    this.tenantChunks.set(tenantId, remaining);
  }

  deleteAll(tenantId: string): void {
    const ids = this.tenantChunks.get(tenantId) || [];
    ids.forEach((id) => this.chunks.delete(id));
    this.tenantChunks.delete(tenantId);
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

  stats(tenantId: string): { totalChunks: number; totalSources: number } {
    const chunks = this.getByTenant(tenantId);
    return { totalChunks: chunks.length, totalSources: new Set(chunks.map((chunk) => chunk.sourceName)).size };
  }
}
