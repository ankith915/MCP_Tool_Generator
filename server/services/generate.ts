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
