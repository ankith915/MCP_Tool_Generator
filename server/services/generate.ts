import JSZip from "jszip";
import { renderAll } from "@/lib/templates/eta";
import type { WizardConfig } from "@/lib/schemas/wizard";

const MCP_SDK_VERSION = "1.29.0";
const TEMPLATE_VERSION = 1;
const TEMPLATE_DIR = "typescript/streamable-http";

type TemplateContext = WizardConfig & {
  MCP_SDK_VERSION: string;
  tool: WizardConfig["tool"] & {
    handlerName: string;
  };
};

function buildContext(config: WizardConfig): TemplateContext {
  const nameParts = config.tool.name.split("_");
  const pascal = nameParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return {
    ...config,
    MCP_SDK_VERSION,
    tool: {
      ...config.tool,
      handlerName: `handle${pascal}`,
    },
  };
}

function buildTemplateMap(config: WizardConfig): Array<{ tpl: string; out: string }> {
  return [
    { tpl: "package.json.eta", out: "package.json" },
    { tpl: "pnpm-workspace.yaml.eta", out: "pnpm-workspace.yaml" },
    { tpl: "tsconfig.json.eta", out: "tsconfig.json" },
    { tpl: "vitest.config.ts.eta", out: "vitest.config.ts" },
    { tpl: ".env.example.eta", out: ".env.example" },
    { tpl: "README.md.eta", out: "README.md" },
    { tpl: "src/index.ts.eta", out: "src/index.ts" },
    { tpl: "src/tools/tool.ts.eta", out: `src/tools/${config.tool.name}.ts` },
    { tpl: "src/tools/tool.test.ts.eta", out: `src/tools/${config.tool.name}.test.ts` },
  ];
}

/**
 * Renders all template files into an in-memory map of filename → content.
 * Pure function — reads template files from disk, no DB or storage I/O.
 */
export async function renderProject(config: WizardConfig): Promise<Record<string, string>> {
  const ctx = buildContext(config);
  const templateMap = buildTemplateMap(config);
  return renderAll(TEMPLATE_DIR, templateMap, ctx as unknown as Record<string, unknown>);
}

async function zipFiles(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export interface GenerateResult {
  artifactUrl: string;
  files: Record<string, string>;
}

/**
 * Full generation: renders templates, creates ZIP, writes to storage, records in DB.
 * I/O dependencies are lazily imported so renderProject stays usable in isolation.
 */
export async function generate(
  config: WizardConfig,
  userId: string,
  workspaceId: string,
): Promise<GenerateResult> {
  const [{ db }, { storage }, { templates, generations }, { eq, and }] = await Promise.all([
    import("@/db"),
    import("@/lib/storage"),
    import("@/db/schema"),
    import("drizzle-orm"),
  ]);

  const files = await renderProject(config);
  const zipBuffer = await zipFiles(files);

  const artifactKey = `${userId}/${crypto.randomUUID()}.zip`;
  await storage.put(artifactKey, zipBuffer);
  const artifactUrl = storage.url(artifactKey);

  const existing = await db
    .select({ id: templates.id })
    .from(templates)
    .where(
      and(
        eq(templates.language, "typescript"),
        eq(templates.framework, "sdk"),
        eq(templates.transport, "streamable-http"),
        eq(templates.version, TEMPLATE_VERSION),
      ),
    )
    .limit(1);

  let templateId: string;
  if (existing[0]) {
    templateId = existing[0].id;
  } else {
    const inserted = await db
      .insert(templates)
      .values({
        language: "typescript",
        framework: "sdk",
        transport: "streamable-http",
        version: TEMPLATE_VERSION,
      })
      .returning({ id: templates.id });

    if (!inserted[0]) {
      throw new Error("Failed to insert template row");
    }
    templateId = inserted[0].id;
  }

  await db.insert(generations).values({
    userId,
    workspaceId,
    templateId,
    config: config as unknown as Record<string, unknown>,
    artifactUrl,
    sdkVersion: MCP_SDK_VERSION,
  });

  return { artifactUrl, files };
}
