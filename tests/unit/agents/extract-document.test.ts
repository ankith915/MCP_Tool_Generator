import { describe, it, expect } from "vitest";
import {
  extractDocument,
  kindForFilename,
  MAX_EXTRACTED_CHARS,
} from "@/lib/agents/extract-document";

function bufferOf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

describe("kindForFilename", () => {
  it("detects supported types from the extension", () => {
    expect(kindForFilename("notes.pdf")).toBe("pdf");
    expect(kindForFilename("design.DOCX")).toBe("docx");
    expect(kindForFilename("README.md")).toBe("markdown");
    expect(kindForFilename("plan.markdown")).toBe("markdown");
    expect(kindForFilename("scratch.txt")).toBe("text");
  });

  it("returns null for unsupported or missing extensions", () => {
    expect(kindForFilename("malware.exe")).toBeNull();
    expect(kindForFilename("noext")).toBeNull();
    expect(kindForFilename("image.png")).toBeNull();
  });
});

describe("extractDocument (plain text + markdown)", () => {
  it("returns UTF-8 decoded text for .txt", async () => {
    const out = await extractDocument("notes.txt", bufferOf("hello world"));
    expect(out.text).toBe("hello world");
    expect(out.redactedCount).toBe(0);
    expect(out.wasTruncated).toBe(false);
    expect(out.rawCharCount).toBe("hello world".length);
  });

  it("handles markdown files identically", async () => {
    const md = "# Heading\n\nSome body text.";
    const out = await extractDocument("plan.md", bufferOf(md));
    expect(out.text).toBe(md);
  });

  it("redacts secrets in the extracted text", async () => {
    const body =
      "Use these creds: AKIAIOSFODNN7EXAMPLE and sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678";
    const out = await extractDocument("creds.txt", bufferOf(body));
    expect(out.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(out.text).not.toContain("sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678");
    expect(out.text).toContain("[AWS_KEY]");
    expect(out.text).toContain("[OPENAI_KEY]");
    expect(out.redactedCount).toBeGreaterThanOrEqual(2);
  });

  it("caps output at MAX_EXTRACTED_CHARS and flags truncation", async () => {
    const huge = "x".repeat(MAX_EXTRACTED_CHARS + 5_000);
    const out = await extractDocument("dump.txt", bufferOf(huge));
    expect(out.wasTruncated).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(MAX_EXTRACTED_CHARS);
    expect(out.rawCharCount).toBe(huge.length);
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractDocument("malware.exe", bufferOf("x")),
    ).rejects.toThrow(/UNSUPPORTED_FILE_TYPE/);
  });
});
