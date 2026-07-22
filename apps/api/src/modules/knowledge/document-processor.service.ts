import { Injectable } from "@nestjs/common";
import { DocumentParserService } from "./document-parser.service";
import { ChunkerService } from "./chunker.service";
import { TextCleanerService } from "./text-cleaner.service";
import { EmbeddingsService } from "./embeddings.service";
import { RagService } from "./rag.service";
import type { DocumentProcessingJob } from "./document-types";

@Injectable()
export class DocumentProcessorService {
  constructor(
    private readonly parser: DocumentParserService,
    private readonly chunker: ChunkerService,
    private readonly textCleaner: TextCleanerService,
    private readonly embeddings: EmbeddingsService,
    private readonly rag: RagService,
  ) {}

  async process(
    job: DocumentProcessingJob,
  ): Promise<{ success: boolean; error?: string; chunks?: number }> {
    let buffer: Buffer;
    if (job.bufferBase64) {
      buffer = Buffer.from(job.bufferBase64, "base64");
    } else if (job.filePath) {
      const fs = await import("fs/promises");
      buffer = await fs.readFile(job.filePath);
    } else {
      return { success: false, error: "No file data provided" };
    }

    const parseResult = await this.parser.parse(buffer, job.filename, job.mimeType);
    if (!parseResult.success) return { success: false, error: parseResult.error || "Parse failed" };
    if (!parseResult.document?.text || parseResult.document.text.length < 10)
      return { success: false, error: "Extracted text too short" };

    const rawText = this.textCleaner.clean(parseResult.document.text);
    const chunks = await this.chunker.chunkText(rawText);
    if (chunks.length === 0) return { success: false, error: "No chunks generated" };

    const chunkTexts = chunks.map((c) => c.content);
    let embeddings: number[][];
    try {
      embeddings = await this.embeddings.createBatch(chunkTexts);
    } catch (error) {
      return {
        success: false,
        error: `Embedding generation failed: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }

    for (let i = 0; i < chunks.length; i++) {
      this.rag.storeChunk(job.tenantId, chunks[i].content, embeddings[i], {
        sourceName: job.filename,
        chunkIndex: chunks[i].chunkIndex,
        tokenCount: chunks[i].tokenCount,
      });
    }

    return { success: true, chunks: chunks.length };
  }
}
