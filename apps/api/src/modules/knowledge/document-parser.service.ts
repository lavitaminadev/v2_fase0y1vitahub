import { Injectable } from "@nestjs/common";
import type { ParsedDocument } from "./document-types";
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "./document-types";
import { parseText } from "./parsers/text.parser";
import { parseCsv } from "./parsers/csv.parser";
import { parseHtml } from "./parsers/html.parser";

export type ParseResult = { success: boolean; document?: ParsedDocument; error?: string };

function getExtension(filename: string): string {
  return filename.substring(filename.lastIndexOf(".")).toLowerCase();
}

@Injectable()
export class DocumentParserService {
  validateFile(buffer: Buffer, filename: string, mimeType?: string): string | null {
    if (!buffer || buffer.length === 0) return "File is empty";
    if (buffer.length > MAX_FILE_SIZE) return `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    const ext = getExtension(filename);
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `File type "${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) return `MIME type "${mimeType}" is not allowed.`;
    return null;
  }

  async parse(buffer: Buffer, filename: string, mimeType?: string): Promise<ParseResult> {
    const validationError = this.validateFile(buffer, filename, mimeType);
    if (validationError) return { success: false, error: validationError };

    const ext = getExtension(filename);
    try {
      switch (ext) {
        case ".csv":
          return { success: true, document: await parseCsv(buffer, filename) };
        case ".md":
        case ".txt":
          return { success: true, document: await parseText(buffer, filename) };
        case ".html":
          return { success: true, document: await parseHtml(buffer, filename) };
        default:
          return { success: false, error: `Unsupported file type: ${ext}` };
      }
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }
}
