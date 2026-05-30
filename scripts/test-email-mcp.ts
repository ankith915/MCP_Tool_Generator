import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runClarificationTurn } from "@/lib/agents/clarification-agent";
import { runPlanAgent } from "@/lib/agents/plan-agent";
import { renderAgenticProject } from "@/server/services/generate";
import {
  extractedFactsSchema,
  type ClarificationTurnResult,
  type PartialExtractedFacts,
  type PlanProposal,
} from "@/lib/schemas/agents";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const envFile = path.join(projectRoot, ".env.local");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const outDir = path.join(projectRoot, ".artifacts", "email-mcp-test");
fs.mkdirSync(outDir, { recursive: true });

function divider(s: string) {
  console.log("\n" + "═".repeat(80));
  console.log("  " + s);
  console.log("═".repeat(80));
}

function pretty(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

const USER_MESSAGES = [
  "I want to build an MCP server that exposes our internal email infrastructure to AI agents. The server should let agents (1) send transactional emails to internal users, (2) look up the delivery status of a previously sent message by its message ID, and (3) list the most recent emails sent to a given internal user. Backend is Postmark for sending and our own Postgres table 'email_log' for status and history. Internal use only inside the platform team.",
  "Server name should be email-ops-mcp. Bounded context: transactional email for the platform. Data classification on email_log: internal (contains employee email addresses + message bodies). Postmark is the only external service.",
  "Required scopes: email:send for the send tool, email:read for the lookup and list tools. List should paginate at 50 per page with an opaque cursor.",
  "SLOs: p95 latency 800ms for send, 200ms for the read tools. Availability 99.5%. Traffic is bursty — about 5 calls/min average but can spike to 30/min during incident workflows.",
];

async function main() {
  divider("E2E: Email MCP via real Groq");

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let priorFacts: PartialExtractedFacts = {};
  let lastTurn: ClarificationTurnResult | null = null;

  for (let i = 0; i < USER_MESSAGES.length; i++) {
    const userMessage = USER_MESSAGES[i]!;
    console.log(`\n── Turn ${i + 1} ──\n> ${userMessage.slice(0, 120)}${userMessage.length > 120 ? "…" : ""}`);
    const start = Date.now();
    const turn = await runClarificationTurn({ history, userMessage, priorFacts });
    const elapsed = Date.now() - start;
    console.log(`(took ${elapsed}ms)`);
    console.log(`  completeness: ${turn.completenessScore.toFixed(2)}`);
    console.log(`  readyForPlan: ${turn.readyForPlan}`);
    console.log(`  violations: ${turn.violations.length}`);
    console.log(`  advisories: ${turn.advisories.length}`);
    console.log(`  next question: ${turn.nextQuestion ?? "(none)"}`);

    fs.writeFileSync(path.join(outDir, `turn-${i + 1}.json`), pretty(turn));
    lastTurn = turn;
    priorFacts = turn.extractedFacts;
    history.push({ role: "user", content: userMessage });
    history.push({
      role: "assistant",
      content: turn.nextQuestion ?? "(I have enough)",
    });
    if (turn.readyForPlan) break;
    // Free-tier rate limits — pause between turns.
    if (i < USER_MESSAGES.length - 1) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  if (!lastTurn) throw new Error("no clarification turn ran");

  divider("Last clarification turn");
  console.log(pretty({
    violations: lastTurn.violations,
    advisories: lastTurn.advisories,
    extractedFacts: lastTurn.extractedFacts,
    readyForPlan: lastTurn.readyForPlan,
  }));

  if (!lastTurn.readyForPlan) {
    divider("Forcing plan stage with current facts");
  }

  const factsCheck = extractedFactsSchema.safeParse(lastTurn.extractedFacts);
  if (!factsCheck.success) {
    console.error("Facts are not yet complete enough for plan agent:");
    console.error(pretty(factsCheck.error.issues));
    process.exit(1);
  }

  divider("Running plan agent");
  const planStart = Date.now();
  const plan: PlanProposal = await runPlanAgent(factsCheck.data);
  console.log(`(took ${Date.now() - planStart}ms)`);
  console.log(`  serverName: ${plan.serverName}`);
  console.log(`  tools: ${plan.tools.map((t) => t.name).join(", ")}`);
  console.log(`  violations: ${plan.violations.length}`);
  console.log(`  crosscutting: ${plan.crosscutting.join(", ")}`);

  fs.writeFileSync(path.join(outDir, "plan.json"), pretty(plan));

  divider("Plan violations");
  if (plan.violations.length === 0) {
    console.log("  (none — plan is clean)");
  } else {
    for (const v of plan.violations) {
      console.log(`  [${v.code}] ${v.path}${v.section ? ` (${v.section})` : ""}: ${v.message}`);
    }
  }

  divider("Plan tools");
  for (const t of plan.tools) {
    console.log(`\n  • ${t.name} [${t.safetyClass}${t.idempotent ? ", idempotent" : ""}]`);
    console.log(`      doc.purpose: ${t.doc?.purpose ?? "(none)"}`);
    console.log(`      inputs: ${t.inputs.map((i) => `${i.name}:${i.type}${i.required ? "" : "?"}`).join(", ") || "(none)"}`);
    console.log(`      scopes: ${t.requiredScopes.join(", ") || "(none)"}`);
    console.log(`      evals: ${t.evals.length}`);
  }

  divider("Rendering template");
  const files = await renderAgenticProject(plan);
  console.log(`  Rendered ${Object.keys(files).length} files.`);
  const outProjectDir = path.join(outDir, "project");
  fs.rmSync(outProjectDir, { recursive: true, force: true });
  for (const [filename, content] of Object.entries(files)) {
    const fullPath = path.join(outProjectDir, filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  console.log(`  Project written to ${outProjectDir}`);
  console.log(`  Files:`);
  for (const f of Object.keys(files).sort()) console.log(`    ${f}`);

  divider("Done");
  console.log(`Artifacts in: ${outDir}`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
