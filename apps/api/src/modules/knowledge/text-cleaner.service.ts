import { Injectable } from "@nestjs/common";

@Injectable()
export class TextCleanerService {
  clean(text: string): string {
    return text
      .replace(/\0/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\t/g, " ")
      .replace(/[ \t]{4,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/\u00A0/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n")
      .trim();
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
