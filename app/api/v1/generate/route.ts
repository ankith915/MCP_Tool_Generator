import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generate } from "@/server/services/generate";
import { wizardConfigSchema } from "@/lib/schemas/wizard";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResult<{ url: string }>>> {
  const user = await getCurrentUser(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.VALIDATION_FAILED, message: "Invalid JSON body" },
      } satisfies ApiResult<{ url: string }>,
      { status: 400 },
    );
  }

  const parsed = wizardConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCodes.VALIDATION_FAILED,
          message: "Invalid configuration",
          details: parsed.error.issues,
        },
      } satisfies ApiResult<{ url: string }>,
      { status: 400 },
    );
  }

  const rl = await rateLimit.check(
    `generate:${user.id}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCodes.RATE_LIMITED,
          message: `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}`,
        },
      } satisfies ApiResult<{ url: string }>,
      { status: 429 },
    );
  }

  try {
    const result = await generate(parsed.data, user.id, user.workspaceId);
    logger.info({ event: "generation.completed", userId: user.id });
    return NextResponse.json(
      { ok: true, data: { url: result.artifactUrl } } satisfies ApiResult<{ url: string }>,
    );
  } catch (err) {
    logger.error({ event: "generation.failed", userId: user.id, err });
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: "Generation failed" },
      } satisfies ApiResult<{ url: string }>,
      { status: 500 },
    );
  }
}
