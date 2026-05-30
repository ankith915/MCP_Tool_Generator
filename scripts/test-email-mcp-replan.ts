import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPlanAgent } from "@/lib/agents/plan-agent";
import { renderAgenticProject } from "@/server/services/generate";
import {
  extractedFactsSchema,
  type Advisory,
  type ClarificationTurnResult,
  type PlanProposal,
} from "@/lib/schemas/agents";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const outDir = path.join(projectRoot, ".artifacts", "email-mcp-test");

function divider(s: string) {
  console.log("\n" + "═".repeat(80));
  console.log("  " + s);
  console.log("═".repeat(80));
}
const pretty = (o: unknown) => JSON.stringify(o, null, 2);

async function main() {
  divider("E2E REPLAN: Email MCP — improved plan agent");

  // Load the last clarification turn from the previous run.
  const lastTurnPath = path.join(outDir, "turn-4.json");
  if (!fs.existsSync(lastTurnPath)) {
    console.error("No saved turn-4.json — run test-email-mcp.ts first.");
    process.exit(1);
  }
  const lastTurn: ClarificationTurnResult = JSON.parse(
    fs.readFileSync(lastTurnPath, "utf8"),
  );

  const factsCheck = extractedFactsSchema.safeParse(lastTurn.extractedFacts);
  if (!factsCheck.success) {
    console.error("Saved facts no longer pass schema:");
    console.error(pretty(factsCheck.error.issues));
    process.exit(1);
  }

  divider("Advisories carried into plan");
  const advisories: Advisory[] = lastTurn.advisories ?? [];
  for (const a of advisories) {
    console.log(`  [${a.severity}] ${a.topic}${a.path ? ` ${a.path}` : ""}: ${a.message}`);
  }

  divider("Running plan agent (with advisories)");
  const start = Date.now();
  const plan: PlanProposal = await runPlanAgent(factsCheck.data, advisories);
  console.log(`(took ${Date.now() - start}ms)`);

  fs.writeFileSync(path.join(outDir, "plan-v2.json"), pretty(plan));

  divider("Plan v2 tools (looking for integer type + max_length)");
  for (const t of plan.tools) {
    console.log(`\n  • ${t.name} [${t.safetyClass}${t.idempotent ? ", idempotent" : ""}]`);
    for (const i of t.inputs) {
      const maxLen = i.maxLength ? ` max_length=${i.maxLength}` : "";
      console.log(`      ${i.name}: ${i.type}${i.required ? "" : " (optional)"}${maxLen}`);
    }
    if (t.evals.length > 0) console.log(`      evals: ${t.evals.length}`);
  }

  divider("Re-rendering project (v2)");
  const files = await renderAgenticProject(plan);
  console.log(`  Rendered ${Object.keys(files).length} files.`);
  const outProjectDir = path.join(outDir, "project-v2");
  fs.rmSync(outProjectDir, { recursive: true, force: true });
  for (const [filename, content] of Object.entries(files)) {
    const full = path.join(outProjectDir, filename);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  console.log(`  Written to ${outProjectDir}`);

  divider("Done");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
