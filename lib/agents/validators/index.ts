import {
  serverNameValidator,
  toolNameValidator,
  parameterNameValidator,
} from "./name-validators";
import { maxToolsValidator, uniqueToolNamesValidator } from "./count-validators";
import {
  descriptionMinLengthValidator,
  fieldDescriptionRequiredValidator,
} from "./schema-validators";
import { pythonIdentifierValidator } from "./identifier-validators";
import type {
  ValidatableFacts,
  ValidatablePlan,
  ValidatableTool,
  Violation,
} from "./types";

export type { Violation, ValidatableFacts, ValidatablePlan, ValidatableTool } from "./types";
export {
  serverNameValidator,
  toolNameValidator,
  parameterNameValidator,
} from "./name-validators";
export { maxToolsValidator, uniqueToolNamesValidator } from "./count-validators";
export {
  descriptionMinLengthValidator,
  fieldDescriptionRequiredValidator,
} from "./schema-validators";
export { pythonIdentifierValidator } from "./identifier-validators";

function push(out: Violation[], result: { ok: true } | { ok: false; violation: Violation }): void {
  if (!result.ok) out.push(result.violation);
}

function validateToolShape(
  tool: ValidatableTool,
  path: string,
  out: Violation[],
): void {
  push(out, toolNameValidator(tool.name, `${path}.name`));
  if (tool.description !== undefined) {
    push(out, descriptionMinLengthValidator(tool.description, `${path}.description`));
  }
  for (const [j, input] of (tool.inputs ?? []).entries()) {
    const ipath = `${path}.inputs[${j}]`;
    push(out, parameterNameValidator(input.name, `${ipath}.name`));
    push(out, pythonIdentifierValidator(input.name, `${ipath}.name`));
    push(out, fieldDescriptionRequiredValidator(input, `${ipath}.description`));
  }
}

export function validateExtractedFacts(facts: ValidatableFacts): Violation[] {
  const out: Violation[] = [];
  if (facts.serverName) push(out, serverNameValidator(facts.serverName));
  const tools = facts.proposedTools ?? [];
  for (const [i, tool] of tools.entries()) {
    validateToolShape(tool, `proposedTools[${i}]`, out);
  }
  push(out, maxToolsValidator(tools, "proposedTools"));
  out.push(...uniqueToolNamesValidator(tools, "proposedTools"));
  return out;
}

export function validatePlan(plan: ValidatablePlan): Violation[] {
  const out: Violation[] = [];
  push(out, serverNameValidator(plan.serverName));
  for (const [i, tool] of plan.tools.entries()) {
    validateToolShape(tool, `tools[${i}]`, out);
  }
  push(out, maxToolsValidator(plan.tools));
  out.push(...uniqueToolNamesValidator(plan.tools));
  return out;
}

export function formatViolationsForPrompt(violations: Violation[]): string {
  if (violations.length === 0) return "No deterministic violations detected.";
  return violations
    .map((v) => `- [${v.code}] ${v.path}${v.section ? ` (${v.section})` : ""}: ${v.message}`)
    .join("\n");
}
