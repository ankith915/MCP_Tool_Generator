import type { ValidationResult } from "./types";

const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "match",
  "case",
]);

const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function pythonIdentifierValidator(
  name: string,
  path: string,
): ValidationResult {
  if (!PYTHON_IDENTIFIER.test(name)) {
    return {
      ok: false,
      violation: {
        code: "INVALID_PYTHON_IDENTIFIER",
        path,
        message: `"${name}" is not a valid Python identifier. Names must start with a letter or underscore and contain only letters, digits, and underscores.`,
      },
    };
  }
  if (PYTHON_KEYWORDS.has(name)) {
    return {
      ok: false,
      violation: {
        code: "PYTHON_KEYWORD_COLLISION",
        path,
        message: `"${name}" is a reserved Python keyword and cannot be used as an identifier.`,
      },
    };
  }
  return { ok: true };
}
