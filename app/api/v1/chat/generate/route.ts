import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { planProposalSchema, type PlanProposal } from "@/lib/schemas/agents";
import {
  persistAgenticProject,
  renderAgenticProject,
} from "@/server/services/generate";
import { chunkContent, sortPaths } from "@/lib/stream/chunk";

const requestSchema = z.object({ sessionId: z.string().uuid() });

const RL_MAX = 30;
const RL_WINDOW_MS = 60 * 60 * 1000;

// Chunking knobs for the typing-effect reveal. Total animation is ~1–3s for
// a typical 25–35 file plan; tweak these if you want it slower/faster.
const LINES_PER_CHUNK = 4;
const PER_CHUNK_DELAY_MS = 8;
const BETWEEN_FILES_DELAY_MS = 18;

type SseEvent =
  | { event: "phase"; data: { stage: "rendering" | "zipping" | "done" } }
  | { event: "file-start"; data: { path: string } }
  | { event: "file-delta"; data: { path: string; text: string } }
  | { event: "file-end"; data: { path: string } }
  | {
      event: "done";
      data: { artifactUrl: string; fileCount: number; sessionId: string };
    }
  | { event: "error"; data: { code: string; message: string } };

function sseLine(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function errorResponse(code: string, message: string, status: number): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseLine("error", { code, message }));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser(request);

  const rl = await rateLimit.check(`generate:${user.id}`, RL_MAX, RL_WINDOW_MS);
  if (!rl.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}`,
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_FAILED", "Invalid JSON body", 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION_FAILED", "Invalid request", 400);
  }
  const { sessionId } = parsed.data;

  // Load + authorize session, validate plan, all up front. We want to fail
  // *before* opening the stream so the client gets a clean HTTP error rather
  // than a 200 with an immediate `error` SSE event.
  let plan: PlanProposal;
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
          eq(agentSessions.id, sessionId),
          eq(agentSessions.userId, user.id),
        ),
      )
      .limit(1);
    if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);
    if (session.status !== "approved") {
      return errorResponse(
        "VALIDATION_FAILED",
        `Cannot generate from a session in status '${session.status}'`,
        400,
      );
    }
    const summary = session.summary as { plan?: unknown } | null;
    const planCheck = planProposalSchema.safeParse(summary?.plan);
    if (!planCheck.success) {
      return errorResponse("VALIDATION_FAILED", "Session has no valid plan", 400);
    }
    plan = planCheck.data;
  } catch (err) {
    logger.error({ event: "chat.generate.load_failed", userId: user.id, err });
    return errorResponse("INTERNAL_ERROR", "Failed to load session", 500);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: SseEvent) =>
        controller.enqueue(sseLine(e.event, e.data));

      try {
        // 1. Render the project deterministically (fast, ~50ms).
        emit({ event: "phase", data: { stage: "rendering" } });
        const files = await renderAgenticProject(plan);

        // 2. Reveal files in a sensible order with a typing-effect stream.
        const paths = sortPaths(Object.keys(files));
        for (const path of paths) {
          const content = files[path] ?? "";
          emit({ event: "file-start", data: { path } });
          const chunks = chunkContent(content, LINES_PER_CHUNK);
          for (const chunk of chunks) {
            emit({ event: "file-delta", data: { path, text: chunk } });
            // Don't delay on single-chunk (small) files — keeps short files snappy.
            if (chunks.length > 1) await delay(PER_CHUNK_DELAY_MS);
          }
          emit({ event: "file-end", data: { path } });
          await delay(BETWEEN_FILES_DELAY_MS);
        }

        // 3. Zip + upload + record. After this the artifact is downloadable.
        emit({ event: "phase", data: { stage: "zipping" } });
        const result = await persistAgenticProject(
          files,
          plan,
          user.id,
          user.workspaceId,
          sessionId,
        );

        // 4. Mark the session generated so subsequent messages don't re-clarify.
        const [{ db }, { agentSessions }, { eq }] = await Promise.all([
          import("@/db"),
          import("@/db/schema"),
          import("drizzle-orm"),
        ]);
        await db
          .update(agentSessions)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(agentSessions.id, sessionId));

        logger.info({ event: "chat.generated", userId: user.id, sessionId });

        emit({ event: "phase", data: { stage: "done" } });
        emit({
          event: "done",
          data: {
            artifactUrl: result.artifactUrl,
            fileCount: paths.length,
            sessionId,
          },
        });
        controller.close();
      } catch (err) {
        logger.error({
          event: "chat.generate.failed",
          userId: user.id,
          sessionId,
          err,
        });
        emit({
          event: "error",
          data: { code: "INTERNAL_ERROR", message: "Generation failed" },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
