import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

type SessionPayload = {
  session: {
    id: string;
    status: string;
    summary: unknown;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    structured: unknown;
    createdAt: string;
  }>;
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResult<SessionPayload>>> {
  const user = await getCurrentUser(request);
  const { id } = await ctx.params;

  try {
    const [{ db }, { agentSessions, agentMessages }, { eq, and, asc }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, id), eq(agentSessions.userId, user.id)))
      .limit(1);
    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: ErrorCodes.NOT_FOUND, message: "Session not found" },
        } satisfies ApiResult<SessionPayload>,
        { status: 404 },
      );
    }
    const messages = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, id))
      .orderBy(asc(agentMessages.createdAt));

    return NextResponse.json({
      ok: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          summary: session.summary,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          structured: m.structured,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    } satisfies ApiResult<SessionPayload>);
  } catch (err) {
    logger.error({ event: "chat.session.fetch.failed", userId: user.id, err });
    return NextResponse.json(
      {
        ok: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to fetch session" },
      } satisfies ApiResult<SessionPayload>,
      { status: 500 },
    );
  }
}
