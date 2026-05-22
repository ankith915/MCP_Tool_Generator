import type { WizardConfig } from "@/lib/schemas/wizard";

export type LintSeverity = "error" | "warn";

export interface LintIssue {
  code: string;
  message: string;
  severity: LintSeverity;
  path?: string;
}

export interface LintResult {
  ok: boolean;
  issues: LintIssue[];
}

const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{5,}/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
  /\bxox[bprs]-[A-Za-z0-9-]+/,
  /\bsk_live_[A-Za-z0-9]{24,}\b/,
];

const ACTION_VERB =
  /^(returns?|fetches?|gets?|creates?|updates?|deletes?|sends?|searches?|queries|checks?|validates?|converts?|generates?|provides?|retrieves?|lists?|adds?|removes?|calculates?|processes?|transforms?|parses?|extracts?|submits?|uploads?|downloads?|authenticates?|connects?|disconnects?|subscribes?|notifies?|triggers?|executes?)/i;

const MIN_LEN = 20;

export function lintToolDescription(description: string): LintResult {
  const issues: LintIssue[] = [];

  if (SECRET_PATTERNS.some((p) => p.test(description))) {
    issues.push({
      code: "PROBABLE_SECRET",
      message:
        "Description appears to contain a credential or secret (AWS key, JWT, OpenAI key, GitHub token, etc.). Remove it before generating.",
      severity: "error",
    });
  }

  if (description.length < MIN_LEN) {
    issues.push({
      code: "DESCRIPTION_TOO_SHORT",
      message: `Tool description must be at least ${MIN_LEN} characters. Got ${description.length}. Make it action-oriented and concrete.`,
      severity: "error",
    });
  }

  if (!ACTION_VERB.test(description)) {
    issues.push({
      code: "NOT_ACTION_ORIENTED",
      message:
        'Tool descriptions should start with an action verb (e.g., "Returns", "Fetches", "Creates", "Sends").',
      severity: "warn",
    });
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

export function lintWizardConfig(config: WizardConfig): LintResult {
  const issues: LintIssue[] = [];

  // Full lint (length + action-verb + secrets) on the main tool description.
  const toolResult = lintToolDescription(config.tool.description);
  issues.push(...toolResult.issues.map((i) => ({ ...i, path: "tool.description" })));

  // Parameter descriptions are type hints, not full prose descriptions.
  // Only check for secrets — length and action-verb rules don't apply.
  for (const param of config.tool.parameters) {
    const secretIssues = lintToolDescription(param.description).issues.filter(
      (i) => i.code === "PROBABLE_SECRET",
    );
    issues.push(
      ...secretIssues.map((i) => ({
        ...i,
        path: `tool.parameters.${param.name}.description`,
      })),
    );
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}
