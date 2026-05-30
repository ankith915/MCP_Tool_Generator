/**
 * Helpers for the SSE generate stream. Extracted so they can be unit-tested
 * without spinning up the route handler.
 */

/**
 * Split file content into line-grouped chunks for the typing-effect reveal.
 *
 * - Returns `[]` for empty content so the route can emit `file-start` /
 *   `file-end` without an intervening delta (consistent with empty
 *   `__init__.py` files in the rendered project).
 * - The reconstructed text (joining chunks in order) equals the input
 *   exactly — there's no loss/duplication of trailing newlines.
 */
export function chunkContent(content: string, linesPerChunk: number): string[] {
  if (!content) return [];
  if (linesPerChunk <= 0) {
    throw new Error("linesPerChunk must be a positive integer");
  }
  const lines = content.split("\n");
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const slice = lines.slice(i, i + linesPerChunk);
    const isLast = i + linesPerChunk >= lines.length;
    chunks.push(slice.join("\n") + (isLast ? "" : "\n"));
  }
  return chunks;
}

/**
 * Order paths so the file tree feels coherent during the live reveal:
 * project metadata (root) first, then `app/` (the meaningful source code),
 * then `tests/`. Within each group, parent directories before their
 * children, alphabetical otherwise.
 */
export function sortPaths(paths: string[]): string[] {
  const groupOrder = (p: string): number => {
    if (p.startsWith("app/")) return 1;
    if (p.startsWith("tests/")) return 2;
    return 0;
  };
  return [...paths].sort((a, b) => {
    const ga = groupOrder(a);
    const gb = groupOrder(b);
    if (ga !== gb) return ga - gb;
    const da = a.split("/").length;
    const db = b.split("/").length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}
