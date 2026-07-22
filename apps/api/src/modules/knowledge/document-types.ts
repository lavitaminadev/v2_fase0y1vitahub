export interface ParsedDocument {
  text: string;
  metadata: {
    title?: string;
    pages?: number;
    rows?: number;
    lines?: number;
    words?: number;
    mimeType?: string;
    originalName?: string;
    sizeBytes?: number;
    parser: string;
    warnings?: string[];
    warning?: string;
  };
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  filename: string;
  mimeType: string;
  status: "pending" | "processing" | "ready" | "failed";
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
}

export interface EmbeddingRecord {
  id: string;
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  sourceName: string;
}

export interface DocumentProcessingJob {
  knowledgeSourceId: string;
  tenantId: string;
  filePath?: string;
  bufferBase64?: string;
  mimeType: string;
  filename: string;
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".html"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
