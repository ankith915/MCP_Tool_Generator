"use server";

import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generate } from "@/server/services/generate";
import { wizardConfigSchema } from "@/lib/schemas/wizard";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function generateAction(
  rawConfig: unknown,
): Promise<ApiResult<{ url: string }>> {
  const user = await getCurrentUser();

  const parsed = wizardConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
        message: "Invalid configuration",
        details: parsed.error.issues,
      },
    };
  }

  const rl = await rateLimit.check(
    `generate:${user.id}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.allowed) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.RATE_LIMITED,
        message: `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}`,
      },
    };
  }

  try {
    const result = await generate(parsed.data, user.id, user.workspaceId);
    logger.info({ event: "generation.completed", userId: user.id });
    return { ok: true, data: { url: result.artifactUrl } };
  } catch (err) {
    logger.error({ event: "generation.failed", userId: user.id, err });
    return {
      ok: false,
      error: { code: ErrorCodes.INTERNAL_ERROR, message: "Generation failed" },
    };
  }
}
