import JSZip from "jszip";
import { renderAll } from "@/lib/templates/eta";
import type { WizardConfig } from "@/lib/schemas/wizard";

const MCP_SDK_VERSION = "1.29.0";
const TEMPLATE_VERSION = 1;

type TemplateContext = WizardConfig & {
  MCP_SDK_VERSION: string;
  tool: WizardConfig["tool"] & {
    handlerName: string;
  };
  pythonType: (t: string) => string;
  PascalCase: (s: string) => string;
};

/** Maps a wizard parameter type to a Python type annotation. */
function pythonType(t: string): string {
  if (t === "string") return "str";
  if (t === "number") return "float";
  if (t === "boolean") return "bool";
  return "str";
}

/** Converts a snake_case identifier to PascalCase (e.g. get_greeting → GetGreeting). */
function toPascalCase(s: string): string {
  return s
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function buildContext(config: WizardConfig): TemplateContext {
  const pascal = toPascalCase(config.tool.name);

  return {
    ...config,
    MCP_SDK_VERSION,
    tool: {
      ...config.tool,
      handlerName: `handle${pascal}`,
    },
    pythonType,
    PascalCase: toPascalCase,
  };
}

/** Derives the template directory path from the wizard config. */
function resolveTemplateDir(config: WizardConfig): string {
  const { language, framework, transport } = config;

  if (language === "typescript" && framework === "sdk" && transport === "streamable-http") {
    return "typescript/streamable-http";
  }
  if (language === "typescript" && framework === "sdk" && transport === "stdio") {
    return "typescript/stdio";
  }
  if (language === "python" && framework === "fastmcp" && transport === "streamable-http") {
    return "python/fastmcp/streamable-http";
  }
  if (language === "python" && framework === "fastmcp" && transport === "stdio") {
    return "python/fastmcp/stdio";
  }
  if (language === "python" && framework === "fastapi-mcp" && transport === "streamable-http") {
    return "python/fastapi-mcp/streamable-http";
  }

  throw new Error(
    `No template directory for combination: language=${language}, framework=${framework}, transport=${transport}`,
  );
}

function buildTemplateMap(config: WizardConfig): Array<{ tpl: string; out: string }> {
  const { language, framework, transport } = config;

  if (language === "typescript" && framework === "sdk" && transport === "streamable-http") {
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

  // Template directories for other variants will be added in subsequent sub-phases.
  // This error is expected until those templates are scaffolded.
  throw new Error(
    `Template file list not yet implemented for: language=${language}, framework=${framework}, transport=${transport}`,
  );
}

/**
 * Renders all template files into an in-memory map of filename → content.
 * Pure function — reads template files from disk, no DB or storage I/O.
 */
export async function renderProject(config: WizardConfig): Promise<Record<string, string>> {
  const ctx = buildContext(config);
  const templateDir = resolveTemplateDir(config);
  const templateMap = buildTemplateMap(config);
  return renderAll(templateDir, templateMap, ctx as unknown as Record<string, unknown>);
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
        eq(templates.language, config.language),
        eq(templates.framework, config.framework),
        eq(templates.transport, config.transport),
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
        language: config.language,
        framework: config.framework,
        transport: config.transport,
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
