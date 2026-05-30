import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

const RL_MAX = 60;
const RL_WINDOW_MS = 60_000;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResult<{ sessionId: string }>>> {
  const user = await getCurrentUser(request);

  const rl = await rateLimit.check(`chat:${user.id}`, RL_MAX, RL_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCodes.RATE_LIMITED,
          message: `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}`,
        },
      } satisfies ApiResult<{ sessionId: string }>,
      { status: 429 },
    );
  }

  try {
    const [{ db }, { agentSessions }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
    ]);
    const [row] = await db
      .insert(agentSessions)
      .values({ userId: user.id, workspaceId: user.workspaceId })
      .returning({ id: agentSessions.id });
    if (!row) throw new Error("session insert returned no row");
    logger.info({ event: "chat.session.created", userId: user.id });
    return NextResponse.json({
      ok: true,
      data: { sessionId: row.id },
    } satisfies ApiResult<{ sessionId: string }>);
  } catch (err) {
    logger.error({ event: "chat.session.failed", userId: user.id, err });
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create session" },
      } satisfies ApiResult<{ sessionId: string }>,
      { status: 500 },
    );
  }
}
