/**
 * Extract plain text from an uploaded document so the chat agent can read it.
 *
 * Supported types:
 *   - `.pdf`  → `unpdf` (serverless-friendly, no native deps)
 *   - `.docx` → `mammoth` (raw text extraction, drops formatting)
 *   - `.md`/`.txt` → UTF-8 decode
 *
 * Every extracted result is passed through {@link redactSecrets} before being
 * returned to the client, so a doc containing an API key never round-trips
 * unredacted into the LLM prompt or our log pipeline.
 *
 * Output is capped at {@link MAX_EXTRACTED_CHARS}. Truncated docs are flagged
 * so the UI can warn the user that only the first ~30K chars went to the agent.
 */
import { redactSecrets } from "./redaction";

/** Conservative cap: ~30K chars ≈ ~7K tokens — fits comfortably in the
 * clarification prompt budget alongside the user message + playbook excerpts. */
export const MAX_EXTRACTED_CHARS = 32_000;

export interface ExtractedDocument {
  text: string;
  redactedCount: number;
  wasTruncated: boolean;
  /** Length of the *original* (pre-truncation, pre-redaction) text in chars. */
  rawCharCount: number;
}

export type SupportedKind = "pdf" | "docx" | "markdown" | "text";

const EXT_TO_KIND: Record<string, SupportedKind> = {
  pdf: "pdf",
  docx: "docx",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
};

/** Determine the document kind from the filename. Returns null for unsupported. */
export function kindForFilename(filename: string): SupportedKind | null {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXT_TO_KIND[ext] ?? null;
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  // mammoth's API for raw text takes a Buffer (Node) or arrayBuffer (browser).
  // We're in a route handler (Node), so wrap the ArrayBuffer in a Node Buffer.
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
}

function extractTextLike(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

/**
 * Extract text from an uploaded file. Returns redacted, length-capped text.
 *
 * Throws `Error("UNSUPPORTED_FILE_TYPE")` if the filename's extension is not
 * one of the supported kinds.
 */
export async function extractDocument(
  filename: string,
  buffer: ArrayBuffer,
): Promise<ExtractedDocument> {
  const kind = kindForFilename(filename);
  if (!kind) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  let raw: string;
  switch (kind) {
    case "pdf":
      raw = await extractPdf(buffer);
      break;
    case "docx":
      raw = await extractDocx(buffer);
      break;
    case "markdown":
    case "text":
      raw = extractTextLike(buffer);
      break;
  }

  const rawCharCount = raw.length;
  const truncated = raw.length > MAX_EXTRACTED_CHARS;
  const capped = truncated ? raw.slice(0, MAX_EXTRACTED_CHARS) : raw;
  const { text, redactedCount } = redactSecrets(capped);

  return {
    text,
    redactedCount,
    wasTruncated: truncated,
    rawCharCount,
  };
}
