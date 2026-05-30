import type { ValidationResult, Violation } from "./types";

const MAX_TOOLS = 30;

export function maxToolsValidator(
  tools: { name: string }[],
  path = "tools",
): ValidationResult {
  if (tools.length > MAX_TOOLS) {
    return {
      ok: false,
      violation: {
        code: "TOO_MANY_TOOLS",
        path,
        message: `Server exposes ${tools.length} tools, exceeding the §6.5 cap of ${MAX_TOOLS}. Split into multiple servers along bounded-context lines (§5.3).`,
        section: "§6.5",
      },
    };
  }
  return { ok: true };
}

export function uniqueToolNamesValidator(
  tools: { name: string }[],
  basePath = "tools",
): Violation[] {
  const seen = new Map<string, number[]>();
  tools.forEach((t, idx) => {
    const list = seen.get(t.name) ?? [];
    list.push(idx);
    seen.set(t.name, list);
  });
  const violations: Violation[] = [];
  for (const [name, indexes] of seen.entries()) {
    if (indexes.length > 1) {
      for (const idx of indexes.slice(1)) {
        violations.push({
          code: "TOOL_NAME_DUPLICATE",
          path: `${basePath}[${idx}].name`,
          message: `Tool name "${name}" is used more than once. Tool names must be unique within a server.`,
          section: "§7.2",
        });
      }
    }
  }
  return violations;
}
