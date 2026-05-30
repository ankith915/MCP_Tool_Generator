import type { ValidationResult } from "./types";

const MIN_DESCRIPTION_LENGTH = 20;

export function descriptionMinLengthValidator(
  description: string | undefined,
  path: string,
): ValidationResult {
  const length = description?.length ?? 0;
  if (length < MIN_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      violation: {
        code: "DESCRIPTION_TOO_SHORT",
        path,
        message: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters; got ${length}. The model picks tools by reading prose (§2.4) — make it concrete and action-oriented.`,
        section: "§7.3",
      },
    };
  }
  return { ok: true };
}

export function fieldDescriptionRequiredValidator(
  input: { name: string; description?: string },
  path: string,
): ValidationResult {
  if (!input.description || input.description.trim().length === 0) {
    return {
      ok: false,
      violation: {
        code: "FIELD_DESCRIPTION_MISSING",
        path,
        message: `Parameter "${input.name}" needs a description. The model reads field descriptions to call the tool correctly (§8.3).`,
        section: "§8.3",
      },
    };
  }
  return { ok: true };
}
