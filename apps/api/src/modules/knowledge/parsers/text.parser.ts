import type { ParsedDocument } from "../document-types";

export async function parseText(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  let text = buffer.toString("utf-8");
  text = text
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{4,}/g, "  ")
    .trim();

  return {
    text,
    metadata: {
      parser: "text",
      originalName: filename,
      lines: text.split("\n").length,
      words: text.split(/\s+/).filter(Boolean).length,
    },
  };
}
