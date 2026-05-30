import type { ValidationResult } from "./types";

const SERVER_NAME_PATTERN = /^[a-z][a-z0-9-]*-mcp$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const BANNED_TOOL_PREFIXES = ["manage_", "do_", "handle_", "process_"];
const BANNED_TOOL_BARE_NAMES = new Set(["manage", "do", "handle", "process"]);
const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export function serverNameValidator(name: string, path = "serverName"): ValidationResult {
  if (!SERVER_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      violation: {
        code: "SERVER_NAME_INVALID",
        path,
        message: `Server name must match /^[a-z][a-z0-9-]*-mcp$/ (lowercase, hyphenated, suffixed with -mcp). Got: "${name}".`,
        section: "§7.1",
      },
    };
  }
  return { ok: true };
}

export function toolNameValidator(name: string, path: string): ValidationResult {
  if (!TOOL_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      violation: {
        code: "TOOL_NAME_INVALID",
        path,
        message: `Tool name must be lowercase snake_case starting with a letter. Got: "${name}".`,
        section: "§7.2",
      },
    };
  }
  if (BANNED_TOOL_BARE_NAMES.has(name)) {
    return {
      ok: false,
      violation: {
        code: "TOOL_NAME_GOD_TOOL",
        path,
        message: `Tool name "${name}" is a god-tool. Split into discrete verb_noun tools per anti-pattern §A3.`,
        section: "§A3",
      },
    };
  }
  for (const prefix of BANNED_TOOL_PREFIXES) {
    if (name.startsWith(prefix)) {
      return {
        ok: false,
        violation: {
          code: "TOOL_NAME_BANNED_PREFIX",
          path,
          message: `Tool name starts with banned god-tool prefix "${prefix}". Split into discrete verb_noun tools per anti-pattern §A3. Got: "${name}".`,
          section: "§A3",
        },
      };
    }
  }
  return { ok: true };
}

export function parameterNameValidator(name: string, path: string): ValidationResult {
  if (!PARAMETER_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      violation: {
        code: "PARAMETER_NAME_INVALID",
        path,
        message: `Parameter name must be lowercase snake_case. Got: "${name}".`,
        section: "§7.4",
      },
    };
  }
  return { ok: true };
}
