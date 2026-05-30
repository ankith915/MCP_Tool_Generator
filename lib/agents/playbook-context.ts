import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYBOOK_PATH = path.join(dirname, "..", "..", "docs", "mcp_playbook.md");

let cache: Map<string, string> | null = null;

function load(): Map<string, string> {
  if (cache) return cache;
  const text = fs.readFileSync(PLAYBOOK_PATH, "utf8");
  const sections = new Map<string, string>();
  const lines = text.split("\n");
  let currentKey: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (currentKey && buffer.length) {
      sections.set(currentKey, buffer.join("\n").trim());
    }
  };
  for (const line of lines) {
    const m = /^# (\d+)\. /.exec(line);
    if (m) {
      flush();
      currentKey = `§${m[1]}`;
      buffer = [line];
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  flush();
  cache = sections;
  return sections;
}

export type PlaybookSectionKey = string;

export function getPlaybookSnippets(keys: PlaybookSectionKey[]): string {
  const sections = load();
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const top = k.split(".")[0];
    if (!top || seen.has(top)) continue;
    seen.add(top);
    const body = sections.get(top);
    if (body) parts.push(body);
  }
  return parts.join("\n\n---\n\n");
}

export function listSectionKeys(): string[] {
  return Array.from(load().keys());
}

export function resetPlaybookCache(): void {
  cache = null;
}
