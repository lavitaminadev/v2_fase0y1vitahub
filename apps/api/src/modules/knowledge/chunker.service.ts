import { Injectable } from "@nestjs/common";
import { TextCleanerService } from "./text-cleaner.service";

export interface ChunkResult {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

@Injectable()
export class ChunkerService {
  constructor(private readonly textCleaner: TextCleanerService) {}

  async chunkText(text: string, chunkSize?: number, chunkOverlap?: number): Promise<ChunkResult[]> {
    const cleaned = this.textCleaner.clean(text);
    if (!cleaned) return [];

    const size = chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

    return this.manualChunk(cleaned, size, overlap);
  }

  private manualChunk(text: string, chunkSize: number, chunkOverlap: number): ChunkResult[] {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    const chunks: ChunkResult[] = [];
    let current = "";
    let index = 0;

    for (const para of paragraphs) {
      if ((current + "\n\n" + para).trim().length > chunkSize && current) {
        chunks.push({
          content: current.trim(),
          chunkIndex: index++,
          tokenCount: this.textCleaner.estimateTokenCount(current),
        });
        const words = current.split(" ");
        const overlapWords = words.slice(Math.max(0, words.length - Math.floor(chunkOverlap / 5)));
        current = overlapWords.join(" ") + "\n\n" + para;
      } else {
        current += (current ? "\n\n" : "") + para;
      }
    }
    if (current.trim()) {
      chunks.push({
        content: current.trim(),
        chunkIndex: index,
        tokenCount: this.textCleaner.estimateTokenCount(current),
      });
    }
    return chunks;
  }
}
