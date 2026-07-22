import type { ParsedDocument } from "../document-types";

const MAX_CSV_ROWS = 10000;

export async function parseCsv(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  let papa: any;
  try {
    papa = await import("papaparse");
  } catch {
    return {
      text: "",
      metadata: { parser: "papaparse", originalName: filename, warning: "CSV parser could not be loaded." },
    };
  }

  const content = buffer.toString("utf-8").trim();
  if (!content)
    return {
      text: "",
      metadata: { parser: "papaparse", originalName: filename, warning: "CSV file is empty." },
    };

  try {
    const result = papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
    if (result.errors?.length && result.errors[0]?.type !== "FieldMismatch") {
      return {
        text: "",
        metadata: {
          parser: "papaparse",
          originalName: filename,
          warning: `CSV parse error: ${result.errors[0]?.message}`,
        },
      };
    }
    const rows = result.data as Record<string, string>[];
    const headers = result.meta.fields || [];
    const totalRows = rows.length;
    if (totalRows === 0)
      return {
        text: "",
        metadata: { parser: "papaparse", originalName: filename, warning: "CSV file has no data rows." },
      };
    const displayRows = rows.slice(0, MAX_CSV_ROWS);
    const lines: string[] = [
      `CSV Data: ${filename || "unknown"}\n`,
      `Columns: ${headers.join(", ")}`,
      `Total Rows: ${totalRows}${totalRows > MAX_CSV_ROWS ? ` (showing first ${MAX_CSV_ROWS})` : ""}\n`,
    ];
    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      lines.push(`Row ${i + 1}:`);
      for (const key of headers) {
        const value = row[key] !== undefined ? String(row[key]).trim() : "";
        if (value) lines.push(`  ${key}: ${value}`);
      }
      lines.push("");
    }
    return {
      text: lines.join("\n").trim(),
      metadata: { parser: "papaparse", originalName: filename, rows: totalRows },
    };
  } catch (error) {
    return {
      text: "",
      metadata: {
        parser: "papaparse",
        originalName: filename,
        warning: `CSV parsing failed: ${error instanceof Error ? error.message : "Unknown"}`,
      },
    };
  }
}
