import JSZip from "jszip";
import { renderAll, renderTemplate } from "@/lib/templates/eta";
import type { WizardConfig } from "@/lib/schemas/wizard";
import type { PlanProposal } from "@/lib/schemas/agents";

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
    // existingFastapiService will be used to generate fastapi-mcp wiring in sub-phase 2c
  };
}

/**
 * Single source of truth for every supported (language, framework, transport) combination.
 * Add a new entry here when a template variant is ready; both resolveTemplateDir and
 * buildTemplateMap derive from this registry automatically.
 */
interface VariantConfig {
  language: WizardConfig["language"];
  framework: WizardConfig["framework"];
  transport: WizardConfig["transport"];
  templateDir: string;
  files: (toolName: string) => Array<{ tpl: string; out: string }>;
}

const VARIANT_CONFIGS: VariantConfig[] = [
  {
    language: "typescript",
    framework: "sdk",
    transport: "streamable-http",
    templateDir: "typescript/streamable-http",
    files: (toolName) => [
      { tpl: "package.json.eta", out: "package.json" },
      { tpl: "pnpm-workspace.yaml.eta", out: "pnpm-workspace.yaml" },
      { tpl: "tsconfig.json.eta", out: "tsconfig.json" },
      { tpl: "vitest.config.ts.eta", out: "vitest.config.ts" },
      { tpl: ".env.example.eta", out: ".env.example" },
      { tpl: "README.md.eta", out: "README.md" },
      { tpl: "Dockerfile.eta", out: "Dockerfile" },
      { tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
      { tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
      { tpl: "src/index.ts.eta", out: "src/index.ts" },
      { tpl: "src/tools/tool.ts.eta", out: `src/tools/${toolName}.ts` },
      { tpl: "src/tools/tool.test.ts.eta", out: `src/tools/${toolName}.test.ts` },
    ],
  },
  {
    language: "typescript",
    framework: "sdk",
    transport: "stdio",
    templateDir: "typescript/stdio",
    files: (toolName) => [
      { tpl: "package.json.eta", out: "package.json" },
      { tpl: "pnpm-workspace.yaml.eta", out: "pnpm-workspace.yaml" },
      { tpl: "tsconfig.json.eta", out: "tsconfig.json" },
      { tpl: "vitest.config.ts.eta", out: "vitest.config.ts" },
      { tpl: ".env.example.eta", out: ".env.example" },
      { tpl: "README.md.eta", out: "README.md" },
      { tpl: "Dockerfile.eta", out: "Dockerfile" },
      { tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
      { tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
      { tpl: "src/index.ts.eta", out: "src/index.ts" },
      { tpl: "src/tools/tool.ts.eta", out: `src/tools/${toolName}.ts` },
      { tpl: "src/tools/tool.test.ts.eta", out: `src/tools/${toolName}.test.ts` },
    ],
  },
  {
    language: "python",
    framework: "fastmcp",
    transport: "streamable-http",
    templateDir: "python/fastmcp/streamable-http",
    files: (_toolName) => [
      { tpl: "server.py.eta", out: "server.py" },
      { tpl: "requirements.txt.eta", out: "requirements.txt" },
      { tpl: "pyproject.toml.eta", out: "pyproject.toml" },
      { tpl: "README.md.eta", out: "README.md" },
      { tpl: ".env.example.eta", out: ".env.example" },
      { tpl: "Dockerfile.eta", out: "Dockerfile" },
      { tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
      { tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
      { tpl: "tests/test_server.py.eta", out: "tests/test_server.py" },
    ],
  },
  {
    language: "python",
    framework: "fastmcp",
    transport: "stdio",
    templateDir: "python/fastmcp/stdio",
    files: (_toolName) => [
      { tpl: "server.py.eta", out: "server.py" },
      { tpl: "requirements.txt.eta", out: "requirements.txt" },
      { tpl: "pyproject.toml.eta", out: "pyproject.toml" },
      { tpl: "README.md.eta", out: "README.md" },
      { tpl: ".env.example.eta", out: ".env.example" },
      { tpl: "Dockerfile.eta", out: "Dockerfile" },
      { tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
      { tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
      { tpl: "tests/test_server.py.eta", out: "tests/test_server.py" },
    ],
  },
  {
    language: "python",
    framework: "fastapi-mcp",
    transport: "streamable-http",
    templateDir: "python/fastapi-mcp/streamable-http",
    files: (_toolName) => [
      { tpl: "main.py.eta", out: "main.py" },
      { tpl: "requirements.txt.eta", out: "requirements.txt" },
      { tpl: "pyproject.toml.eta", out: "pyproject.toml" },
      { tpl: "README.md.eta", out: "README.md" },
      { tpl: ".env.example.eta", out: ".env.example" },
      { tpl: "Dockerfile.eta", out: "Dockerfile" },
      { tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
      { tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
      { tpl: "tests/test_main.py.eta", out: "tests/test_main.py" },
    ],
  },
];

/** Returns the variant config for the given wizard config, or throws if not yet implemented. */
function resolveVariant(config: WizardConfig): VariantConfig {
  const variant = VARIANT_CONFIGS.find(
    (vc) =>
      vc.language === config.language &&
      vc.framework === config.framework &&
      vc.transport === config.transport,
  );
  if (!variant) {
    throw new Error(
      `Template variant not implemented: ${config.language}/${config.framework}/${config.transport}`,
    );
  }
  return variant;
}

/** Derives the template directory path from the wizard config. */
function resolveTemplateDir(config: WizardConfig): string {
  return resolveVariant(config).templateDir;
}

function buildTemplateMap(config: WizardConfig): Array<{ tpl: string; out: string }> {
  return resolveVariant(config).files(config.tool.name);
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

const AGENTIC_TEMPLATE_DIR = "python/fastmcp-fastapi/streamable-http";

interface AgenticTemplateContext {
  serverName: string;
  description: string;
  tools: PlanProposal["tools"];
  crosscutting: PlanProposal["crosscutting"];
  verificationChecklist: PlanProposal["verificationChecklist"];
  PascalCase: (s: string) => string;
}

interface PerToolTemplateContext extends AgenticTemplateContext {
  tool: PlanProposal["tools"][number];
}

function buildAgenticContext(plan: PlanProposal): AgenticTemplateContext {
  return {
    serverName: plan.serverName,
    description: plan.description,
    tools: plan.tools,
    crosscutting: plan.crosscutting,
    verificationChecklist: plan.verificationChecklist,
    PascalCase: toPascalCase,
  };
}

async function renderOne(
  templateRelativePath: string,
  ctx: Record<string, unknown>,
): Promise<string> {
  return renderTemplate(`${AGENTIC_TEMPLATE_DIR}/${templateRelativePath}`, ctx);
}

const STATIC_AGENTIC_FILES: Array<{ tpl: string; out: string }> = [
  // Project metadata
  { tpl: "pyproject.toml.eta", out: "pyproject.toml" },
  { tpl: "requirements.txt.eta", out: "requirements.txt" },
  { tpl: ".env.example.eta", out: ".env.example" },
  { tpl: "README.md.eta", out: "README.md" },
  { tpl: "server.json.eta", out: "server.json" },
  { tpl: "Dockerfile.eta", out: "Dockerfile" },
  // Package __init__.py files (all empty)
  { tpl: "_empty.py.eta", out: "app/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/api/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/api/middleware/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/api/routers/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/mcp/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/core/__init__.py" },
  { tpl: "_empty.py.eta", out: "app/domain/__init__.py" },
  { tpl: "_empty.py.eta", out: "tests/__init__.py" },
  { tpl: "_empty.py.eta", out: "tests/unit/__init__.py" },
  { tpl: "_empty.py.eta", out: "tests/integration/__init__.py" },
  { tpl: "_empty.py.eta", out: "tests/contract/__init__.py" },
  // App layer
  { tpl: "app/main.py.eta", out: "app/main.py" },
  { tpl: "app/core/config.py.eta", out: "app/core/config.py" },
  { tpl: "app/core/logging.py.eta", out: "app/core/logging.py" },
  { tpl: "app/core/exceptions.py.eta", out: "app/core/exceptions.py" },
  { tpl: "app/api/errors.py.eta", out: "app/api/errors.py" },
  { tpl: "app/api/middleware/correlation.py.eta", out: "app/api/middleware/correlation.py" },
  { tpl: "app/api/routers/health.py.eta", out: "app/api/routers/health.py" },
  { tpl: "app/mcp/server.py.eta", out: "app/mcp/server.py" },
  { tpl: "app/mcp/schemas.py.eta", out: "app/mcp/schemas.py" },
  { tpl: "app/mcp/tools.py.eta", out: "app/mcp/tools.py" },
  // Tests
  { tpl: "tests/conftest.py.eta", out: "tests/conftest.py" },
  { tpl: "tests/integration/test_health.py.eta", out: "tests/integration/test_health.py" },
  { tpl: "tests/integration/test_mcp_server.py.eta", out: "tests/integration/test_mcp_server.py" },
  { tpl: "tests/contract/test_tool_schemas.py.eta", out: "tests/contract/test_tool_schemas.py" },
];

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield", "match", "case",
]);

const PY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function preZipValidate(plan: PlanProposal): void {
  const seen = new Set<string>();
  for (const t of plan.tools) {
    if (seen.has(t.name)) {
      throw new Error(`GENERATION_INVALID: duplicate tool name ${t.name}`);
    }
    seen.add(t.name);
    if (!PY_IDENTIFIER.test(t.name) || PYTHON_KEYWORDS.has(t.name)) {
      throw new Error(`GENERATION_INVALID: tool name ${t.name} is not a valid Python identifier`);
    }
    for (const p of t.inputs) {
      if (!PY_IDENTIFIER.test(p.name) || PYTHON_KEYWORDS.has(p.name)) {
        throw new Error(
          `GENERATION_INVALID: tool ${t.name} parameter ${p.name} is not a valid Python identifier`,
        );
      }
    }
  }
}

export async function renderAgenticProject(plan: PlanProposal): Promise<Record<string, string>> {
  preZipValidate(plan);
  const ctx = buildAgenticContext(plan);
  const files: Record<string, string> = {};

  for (const { tpl, out } of STATIC_AGENTIC_FILES) {
    files[out] = await renderOne(tpl, ctx as unknown as Record<string, unknown>);
  }

  for (const tool of plan.tools) {
    const toolCtx: PerToolTemplateContext = { ...ctx, tool };
    const tctx = toolCtx as unknown as Record<string, unknown>;
    files[`app/domain/${tool.name}_logic.py`] = await renderOne("app/domain/tool_logic.py.eta", tctx);
    files[`tests/unit/test_${tool.name}.py`] = await renderOne("tests/unit/test_tool.py.eta", tctx);
  }

  return files;
}

/**
 * Persist an already-rendered agentic project: zip the files, upload the
 * archive to storage, and record the generation in the database.
 *
 * Split from {@link generateAgenticProject} so the SSE generate route can
 * call {@link renderAgenticProject} first, emit per-file events while files
 * are revealed in the UI, and then call this to finalize the artifact.
 */
export async function persistAgenticProject(
  files: Record<string, string>,
  plan: PlanProposal,
  userId: string,
  workspaceId: string,
  sessionId: string,
): Promise<GenerateResult> {
  const [{ db }, { storage }, { templates, generations }, { eq, and }] = await Promise.all([
    import("@/db"),
    import("@/lib/storage"),
    import("@/db/schema"),
    import("drizzle-orm"),
  ]);

  const zipBuffer = await zipFiles(files);
  const artifactKey = `${userId}/${crypto.randomUUID()}.zip`;
  await storage.put(artifactKey, zipBuffer);
  const artifactUrl = storage.url(artifactKey);

  const existing = await db
    .select({ id: templates.id })
    .from(templates)
    .where(
      and(
        eq(templates.language, "python"),
        eq(templates.framework, "fastmcp-fastapi"),
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
        language: "python",
        framework: "fastmcp-fastapi",
        transport: "streamable-http",
        version: TEMPLATE_VERSION,
      })
      .returning({ id: templates.id });
    if (!inserted[0]) throw new Error("Failed to insert template row");
    templateId = inserted[0].id;
  }

  await db.insert(generations).values({
    userId,
    workspaceId,
    templateId,
    sessionId,
    config: plan as unknown as Record<string, unknown>,
    artifactUrl,
    sdkVersion: MCP_SDK_VERSION,
  });

  return { artifactUrl, files };
}

export async function generateAgenticProject(
  plan: PlanProposal,
  userId: string,
  workspaceId: string,
  sessionId: string,
): Promise<GenerateResult> {
  const files = await renderAgenticProject(plan);
  return persistAgenticProject(files, plan, userId, workspaceId, sessionId);
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
