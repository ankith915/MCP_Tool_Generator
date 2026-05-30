const SECRET_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, label: "[AWS_KEY]" },
  {
    pattern:
      /\beyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{5,}/g,
    label: "[JWT]",
  },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, label: "[OPENAI_KEY]" },
  { pattern: /\bgsk_[A-Za-z0-9_-]{20,}\b/g, label: "[GROQ_KEY]" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g, label: "[GITHUB_PAT]" },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, label: "[GITHUB_PAT]" },
  { pattern: /\bxox[bprs]-[A-Za-z0-9-]+/g, label: "[SLACK_TOKEN]" },
  { pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/g, label: "[STRIPE_KEY]" },
];

export interface RedactionResult {
  text: string;
  redactedCount: number;
}

export function redactSecrets(text: string): RedactionResult {
  let result = text;
  let count = 0;
  for (const { pattern, label } of SECRET_PATTERNS) {
    result = result.replace(pattern, () => {
      count++;
      return label;
    });
  }
  return { text: result, redactedCount: count };
}
