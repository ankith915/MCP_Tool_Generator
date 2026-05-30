import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { planProposalSchema } from "@/lib/schemas/agents";
import { logger } from "@/lib/logger";

const requestSchema = z.object({ sessionId: z.string().uuid() });

const RL_MAX = 60;
const RL_WINDOW_MS = 60_000;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResult<{ status: "approved" }>>> {
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
      } satisfies ApiResult<{ status: "approved" }>,
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.VALIDATION_FAILED, message: "Invalid JSON body" },
      } satisfies ApiResult<{ status: "approved" }>,
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCodes.VALIDATION_FAILED,
          message: "Invalid request",
          details: parsed.error.issues,
        },
      } satisfies ApiResult<{ status: "approved" }>,
      { status: 400 },
    );
  }

  try {
    const [{ db }, { agentSessions }, { eq, and }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.id, parsed.data.sessionId),
          eq(agentSessions.userId, user.id),
        ),
      )
      .limit(1);
    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: ErrorCodes.NOT_FOUND, message: "Session not found" },
        } satisfies ApiResult<{ status: "approved" }>,
        { status: 404 },
      );
    }
    if (session.status !== "planning") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCodes.VALIDATION_FAILED,
            message: `Cannot approve a session in status '${session.status}'`,
          },
        } satisfies ApiResult<{ status: "approved" }>,
        { status: 400 },
      );
    }

    const summary = session.summary as { plan?: unknown } | null;
    const planCheck = planProposalSchema.safeParse(summary?.plan);
    if (!planCheck.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCodes.VALIDATION_FAILED,
            message: "Session has no valid plan to approve",
          },
        } satisfies ApiResult<{ status: "approved" }>,
        { status: 400 },
      );
    }

    await db
      .update(agentSessions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(agentSessions.id, parsed.data.sessionId));
    logger.info({ event: "chat.session.approved", userId: user.id });
    return NextResponse.json({
      ok: true,
      data: { status: "approved" },
    } satisfies ApiResult<{ status: "approved" }>);
  } catch (err) {
    logger.error({ event: "chat.approve.failed", userId: user.id, err });
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: "Approve failed" },
      } satisfies ApiResult<{ status: "approved" }>,
      { status: 500 },
    );
  }
}
