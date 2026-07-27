import type { ParsedDocument } from "../document-types";

export async function parseHtml(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  let cheerio: any;
  try {
    cheerio = await import("cheerio");
  } catch {
    return {
      text: "",
      metadata: { parser: "cheerio", originalName: filename, warning: "HTML parser could not be loaded." },
    };
  }
  const html = buffer.toString("utf-8").trim();
  if (!html)
    return {
      text: "",
      metadata: { parser: "cheerio", originalName: filename, warning: "HTML content is empty." },
    };
  try {
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, iframe, noscript, svg, form").remove();
    const title = $("title").first().text().trim();
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    const contentParts: string[] = [];
    if (title) contentParts.push(`Title: ${title}`);
    if (metaDescription) contentParts.push(`Description: ${metaDescription}`);
    $("h1, h2, h3, h4, h5, h6").each((_: number, el: any) => {
      const t = $(el).text().trim();
      if (t) contentParts.push(`\n## ${t}`);
    });
    $("p").each((_: number, el: any) => {
      const t = $(el).text().trim();
      if (t) contentParts.push(t);
    });
    $("li").each((_: number, el: any) => {
      const t = $(el).text().trim();
      if (t) contentParts.push(`- ${t}`);
    });
    $("th, td").each((_: number, el: any) => {
      const t = $(el).text().trim();
      if (t) contentParts.push(t);
    });
    const cleanText = contentParts.join("\n").replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]{3,}/g, "  ").trim();
    return {
      text: cleanText,
      metadata: { parser: "cheerio", title, originalName: filename },
    };
  } catch (error) {
    return {
      text: "",
      metadata: {
        parser: "cheerio",
        originalName: filename,
        warning: `HTML parsing failed: ${error instanceof Error ? error.message : "Unknown"}`,
      },
    };
  }
}
