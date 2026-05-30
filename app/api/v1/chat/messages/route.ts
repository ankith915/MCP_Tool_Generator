import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  runClarificationTurn,
  AgentInvalidOutputError,
} from "@/lib/agents/clarification-agent";
import { runPlanAgent, refinePlan } from "@/lib/agents/plan-agent";
import {
  partialExtractedFactsSchema,
  extractedFactsSchema,
  planProposalSchema,
  type PartialExtractedFacts,
} from "@/lib/schemas/agents";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  /** Pre-extracted text from an uploaded document. Cap mirrors the upload
   * route's redaction cap; an extra 2K margin tolerates inflation from
   * placeholders like `[OPENAI_KEY]`. */
  attachmentText: z.string().max(34_000).optional(),
  attachmentName: z.string().max(255).optional(),
});

const RL_MAX = 60;
const RL_WINDOW_MS = 60_000;

type SseEvent =
  | { event: "phase"; data: { stage: "clarifying" | "planning" } }
  | { event: "reasoning"; data: { delta: string } }
  | { event: "done"; data: { type: "clarification" | "plan"; payload: unknown } }
  | { event: "error"; data: { code: string; message: string } };

function sseLine(event: string, data: unknown): Uint8Array {
  const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(text);
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

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser(request);

  const rl = await rateLimit.check(`chat:${user.id}`, RL_MAX, RL_WINDOW_MS);
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
    return errorResponse("VALIDATION_FAILED", "Invalid request shape", 400);
  }

  const { sessionId, content, attachmentText, attachmentName } = parsed.data;

  let priorFacts: PartialExtractedFacts = {};
  let history: { role: "user" | "assistant"; content: string }[] = [];
  let sessionStatus: string;
  let priorSummary: Record<string, unknown> = {};
  try {
    const [{ db }, { agentSessions, agentMessages }, { eq, and, asc }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, user.id)))
      .limit(1);
    if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);
    // `approved` is the brief window between Approve click and /generate POST;
    // we still reject messaging during that window. `generated` is now allowed:
    // it opens a refinement turn (see the refinement branch below).
    if (session.status === "approved") {
      return errorResponse(
        "VALIDATION_FAILED",
        `Cannot message a session in status 'approved' — generation is in flight`,
        400,
      );
    }
    sessionStatus = session.status;
    const summary = session.summary as Record<string, unknown> | null;
    priorSummary = summary ?? {};
    const parsedFacts = partialExtractedFactsSchema.safeParse(
      (summary?.extractedFacts as unknown) ?? {},
    );
    priorFacts = parsedFacts.success ? parsedFacts.data : {};

    const prior = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(asc(agentMessages.createdAt));
    history = prior
      .filter((m) => m.role === "user" || m.role === "clarification" || m.role === "plan")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    await db.insert(agentMessages).values({
      sessionId,
      role: "user",
      content,
    });
    // Status transitions:
    //   clarifying → (stays) clarifying
    //   planning   → back to clarifying (user wants more clarification)
    //   generated  → planning (refinement turn — handled below)
    //   approved   → rejected above
    const nextStatus = sessionStatus === "generated" ? "planning" : "clarifying";
    if (sessionStatus !== nextStatus) {
      await db
        .update(agentSessions)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(agentSessions.id, sessionId));
    }
  } catch (err) {
    logger.error({ event: "chat.messages.load_failed", userId: user.id, err });
    return errorResponse("INTERNAL_ERROR", "Failed to load session", 500);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: SseEvent) => controller.enqueue(sseLine(e.event, e.data));

      try {
        // ---- Refinement branch -------------------------------------------------
        // When the prior session was already `generated`, a new message means
        // "change the plan and re-generate." Skip clarification entirely; feed
        // the prior plan + the user's refinement to refinePlan(), then emit a
        // fresh plan event so the client re-renders PlanReview for approval.
        if (sessionStatus === "generated") {
          emit({ event: "phase", data: { stage: "planning" } });
          const priorPlan = planProposalSchema.safeParse(priorSummary.plan);
          if (!priorPlan.success) {
            emit({
              event: "error",
              data: {
                code: "VALIDATION_FAILED",
                message: "Cannot refine: prior plan is missing or invalid",
              },
            });
            controller.close();
            return;
          }
          const refinementInstruction = attachmentText
            ? `${content}\n\n[Attached document: ${attachmentName ?? "uploaded file"}]\n${attachmentText}`
            : content;
          const refined = await refinePlan(priorPlan.data, refinementInstruction, {
            onReasoning: (delta) =>
              emit({ event: "reasoning", data: { delta } }),
          });
          const [{ db }, { agentSessions, agentMessages }, { eq }] = await Promise.all([
            import("@/db"),
            import("@/db/schema"),
            import("drizzle-orm"),
          ]);
          await db.insert(agentMessages).values({
            sessionId,
            role: "plan",
            content: refined.description,
            structured: refined,
          });
          await db
            .update(agentSessions)
            .set({
              summary: { ...priorSummary, plan: refined },
              updatedAt: new Date(),
            })
            .where(eq(agentSessions.id, sessionId));
          emit({ event: "done", data: { type: "plan", payload: refined } });
          controller.close();
          return;
        }

        // ---- Clarification branch (initial turn or continued clarification) ---
        emit({ event: "phase", data: { stage: "clarifying" } });
        // Weave any attachment into the user message for THIS turn only.
        // The bare `content` is what we persisted to agentMessages above; the
        // doc text is intentionally turn-scoped (re-attach for later turns).
        const userMessage = attachmentText
          ? `[Attached document: ${attachmentName ?? "uploaded file"}]\n${attachmentText}\n\n---\n\n${content}`
          : content;
        const turn = await runClarificationTurn({ history, userMessage, priorFacts });

        const [{ db }, { agentSessions, agentMessages }, { eq }] = await Promise.all([
          import("@/db"),
          import("@/db/schema"),
          import("drizzle-orm"),
        ]);

        await db.insert(agentMessages).values({
          sessionId,
          role: "clarification",
          content: turn.nextQuestion ?? "(no further questions)",
          structured: turn,
        });

        const updatedSummary = {
          extractedFacts: turn.extractedFacts,
          violations: turn.violations,
          advisories: turn.advisories,
        };
        if (turn.readyForPlan) {
          await db
            .update(agentSessions)
            .set({ status: "planning", summary: updatedSummary, updatedAt: new Date() })
            .where(eq(agentSessions.id, sessionId));
        } else {
          await db
            .update(agentSessions)
            .set({ summary: updatedSummary, updatedAt: new Date() })
            .where(eq(agentSessions.id, sessionId));
        }

        if (!turn.readyForPlan) {
          emit({ event: "done", data: { type: "clarification", payload: turn } });
          controller.close();
          return;
        }

        emit({ event: "phase", data: { stage: "planning" } });

        const factsForPlan = extractedFactsSchema.safeParse(turn.extractedFacts);
        if (!factsForPlan.success) {
          emit({
            event: "error",
            data: {
              code: "AGENT_INVALID_OUTPUT",
              message: "Cannot run plan agent: extracted facts are incomplete",
            },
          });
          controller.close();
          return;
        }

        const plan = await runPlanAgent(factsForPlan.data, turn.advisories, {
          onReasoning: (delta) => emit({ event: "reasoning", data: { delta } }),
        });
        await db.insert(agentMessages).values({
          sessionId,
          role: "plan",
          content: plan.description,
          structured: plan,
        });
        await db
          .update(agentSessions)
          .set({
            summary: { ...updatedSummary, plan },
            updatedAt: new Date(),
          })
          .where(eq(agentSessions.id, sessionId));

        emit({ event: "done", data: { type: "plan", payload: plan } });
        controller.close();
      } catch (err) {
        if (err instanceof AgentInvalidOutputError) {
          emit({
            event: "error",
            data: { code: "AGENT_INVALID_OUTPUT", message: err.message },
          });
        } else {
          logger.error({ event: "chat.turn.failed", userId: user.id, err });
          emit({
            event: "error",
            data: { code: "INTERNAL_ERROR", message: "Agent turn failed" },
          });
        }
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
