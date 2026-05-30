export const ErrorCodes = {
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  GENERATION_REFUSED: "GENERATION_REFUSED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  STORAGE_ERROR: "STORAGE_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  AGENT_INVALID_OUTPUT: "AGENT_INVALID_OUTPUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } };
