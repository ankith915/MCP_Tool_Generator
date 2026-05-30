import { describe, it, expect } from "vitest";
import { renderAgenticProject } from "@/server/services/generate";
import type { PlanProposal } from "@/lib/schemas/agents";

const PLAN: PlanProposal = {
  serverName: "orders-mcp",
  description: "Internal orders MCP server.",
  tools: [
    {
      name: "get_order",
      description: "Returns a single order by id.",
      safetyClass: "read",
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string",
          required: true,
          description: "Unique order id.",
          maxLength: 64,
        },
      ],
      outputShape: "{ id, status, line_items[] }",
      failureModes: ["not_found", "validation"],
      requiredScopes: ["orders:read"],
      doc: {
        purpose: "Return the order with the given id.",
        parameters: "order_id is canonical.",
        returns: "OrderRecord with status and line items.",
        failureModes: "not_found when the id is unknown.",
      },
      evals: [
        {
          prompt: "Get me order 12345 please",
          expectedTool: "get_order",
          expectedArguments: { order_id: "12345" },
        },
      ],
    },
    {
      name: "list_shipments",
      description: "Lists shipments for an order.",
      safetyClass: "read",
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string",
          required: true,
          description: "The order id.",
        },
      ],
      outputShape: "{ items, next_cursor }",
      failureModes: ["not_found"],
      requiredScopes: ["orders:read"],
      evals: [],
    },
  ],
  folderStructure: ["app/main.py"],
  crosscutting: ["structlog", "otel", "health-endpoints"],
  verificationChecklist: ["Tool names are verb_noun"],
  violations: [],
};

describe("renderAgenticProject (fastmcp-fastapi variant)", () => {
  it("renders the expected file set for a 2-tool plan", async () => {
    const files = await renderAgenticProject(PLAN);
    const expected = [
      // Project metadata
      "pyproject.toml",
      "requirements.txt",
      ".env.example",
      "README.md",
      "server.json",
      "Dockerfile",
      // Package layout
      "app/__init__.py",
      "app/api/__init__.py",
      "app/api/middleware/__init__.py",
      "app/api/routers/__init__.py",
      "app/mcp/__init__.py",
      "app/core/__init__.py",
      "app/domain/__init__.py",
      // App
      "app/main.py",
      "app/core/config.py",
      "app/core/logging.py",
      "app/core/exceptions.py",
      "app/api/errors.py",
      "app/api/middleware/correlation.py",
      "app/api/routers/health.py",
      "app/mcp/server.py",
      "app/mcp/schemas.py",
      "app/mcp/tools.py",
      // Per-tool
      "app/domain/get_order_logic.py",
      "app/domain/list_shipments_logic.py",
      // Tests
      "tests/conftest.py",
      "tests/integration/test_health.py",
      "tests/integration/test_mcp_server.py",
      "tests/contract/test_tool_schemas.py",
      "tests/unit/test_get_order.py",
      "tests/unit/test_list_shipments.py",
    ];
    for (const f of expected) {
      expect(files, `missing ${f}`).toHaveProperty(f);
    }
  });

  it("schemas.py declares one Pydantic class per tool with extra=forbid + descriptions", async () => {
    const files = await renderAgenticProject(PLAN);
    const schemas = files["app/mcp/schemas.py"]!;
    expect(schemas).toContain("class GetOrderInput(BaseModel):");
    expect(schemas).toContain("class ListShipmentsInput(BaseModel):");
    expect(schemas).toContain('extra="forbid"');
    expect(schemas).toContain('description="Unique order id."');
    expect(schemas).toContain("max_length=64");
  });

  it("tools.py defines ToolHandlers with a method per tool and {success,data,meta} envelope", async () => {
    const files = await renderAgenticProject(PLAN);
    const tools = files["app/mcp/tools.py"]!;
    expect(tools).toContain("class ToolHandlers:");
    expect(tools).toContain("async def get_order(self, arguments: dict[str, Any])");
    expect(tools).toContain("async def list_shipments(self, arguments: dict[str, Any])");
    // Lifecycle log events
    expect(tools).toContain('"mcp_tool_invoked"');
    expect(tools).toContain('"mcp_tool_complete"');
    expect(tools).toContain('"mcp_tool_validation_failed"');
    // NotImplementedError is converted to envelope, never raised through the boundary
    expect(tools).toContain("except NotImplementedError");
    // Envelope keys
    expect(tools).toContain('"success"');
    expect(tools).toContain('"data"');
    expect(tools).toContain('"meta"');
    // Imports each domain stub
    expect(tools).toContain("from app.domain.get_order_logic import compute_get_order");
    expect(tools).toContain("from app.domain.list_shipments_logic import compute_list_shipments");
  });

  it("server.py uses FastMCP @mcp.tool with the strictness workaround + lifecycle", async () => {
    const files = await renderAgenticProject(PLAN);
    const server = files["app/mcp/server.py"]!;
    expect(server).toContain("from mcp.server.fastmcp import FastMCP");
    expect(server).toContain("@mcp.tool(name=TOOL_GET_ORDER");
    expect(server).toContain("@mcp.tool(name=TOOL_LIST_SHIPMENTS");
    // Strictness workaround
    expect(server).toContain("_apply_strict_input");
    expect(server).toContain('"extra": "forbid"');
    expect(server).toContain("model_rebuild(force=True)");
    // Lifecycle
    expect(server).toContain("async def startup()");
    expect(server).toContain("async def shutdown()");
    expect(server).toContain("class MCPServerBundle");
  });

  it("logging.py is structlog-with-context: rename event→message + contextvars helpers", async () => {
    const files = await renderAgenticProject(PLAN);
    const logging = files["app/core/logging.py"]!;
    expect(logging).toContain("import structlog");
    expect(logging).toContain("_rename_event_key");
    expect(logging).toContain('event_dict["message"] = event_dict.pop("event")');
    expect(logging).toContain("bind_request_context");
    expect(logging).toContain("clear_request_context");
    expect(logging).toContain("contextvars");
  });

  it("exceptions.py defines AppError with code + http_status + to_dict()", async () => {
    const files = await renderAgenticProject(PLAN);
    const exc = files["app/core/exceptions.py"]!;
    expect(exc).toContain("class AppError(Exception):");
    expect(exc).toContain("http_status: ClassVar[int]");
    expect(exc).toContain("def to_dict(self)");
    // Full typed tree
    for (const cls of [
      "ConfigurationError",
      "ValidationError",
      "AuthenticationError",
      "AuthorizationError",
      "NotFoundError",
      "RateLimitedError",
      "UpstreamError",
      "ServiceUnavailableError",
    ]) {
      expect(exc, `missing ${cls}`).toContain(`class ${cls}`);
    }
    expect(exc).toContain("__all__");
  });

  it("correlation middleware emits request_started/finished and echoes the header", async () => {
    const files = await renderAgenticProject(PLAN);
    const mw = files["app/api/middleware/correlation.py"]!;
    expect(mw).toContain('"request_started"');
    expect(mw).toContain('"request_finished"');
    expect(mw).toContain("X-Correlation-ID");
    expect(mw).toContain("class CorrelationMiddleware(BaseHTTPMiddleware)");
    expect(mw).toContain("_sanitize_inbound");
    expect(mw).toContain("bind_request_context");
  });

  it("health.py exposes /healthz /readyz /startupz with CheckResult + asyncio.gather", async () => {
    const files = await renderAgenticProject(PLAN);
    const health = files["app/api/routers/health.py"]!;
    expect(health).toContain('@router.get(\n    "/healthz"');
    expect(health).toContain('@router.get(\n    "/readyz"');
    expect(health).toContain('@router.get(\n    "/startupz"');
    expect(health).toContain("class CheckResult");
    expect(health).toContain("asyncio.gather");
    expect(health).toContain("asyncio.timeout");
  });

  it("domain stub raises NotImplementedError with the §7.3 docstring fields", async () => {
    const files = await renderAgenticProject(PLAN);
    const domain = files["app/domain/get_order_logic.py"]!;
    expect(domain).toContain("async def compute_get_order(params: GetOrderInput)");
    expect(domain).toContain("raise NotImplementedError(");
    expect(domain).toContain("Return the order with the given id.");
    expect(domain).toContain("OrderRecord with status and line items.");
    expect(domain).toContain("Required scopes: orders:read");
  });

  it("server.json manifest matches plan", async () => {
    const files = await renderAgenticProject(PLAN);
    const manifest = JSON.parse(files["server.json"]!);
    expect(manifest.name).toBe("orders-mcp");
    expect(manifest.tools).toHaveLength(2);
    expect(manifest.tools[0]).toEqual({
      name: "get_order",
      safety: "read",
      scopes: ["orders:read"],
    });
  });

  it("rejects a plan with a Python-keyword tool name (pre-zip validation)", async () => {
    const bad: PlanProposal = {
      ...PLAN,
      tools: [{ ...PLAN.tools[0]!, name: "class" }],
    };
    await expect(renderAgenticProject(bad)).rejects.toThrow(/GENERATION_INVALID/);
  });

  it("rejects a plan with duplicate tool names (pre-zip validation)", async () => {
    const bad: PlanProposal = {
      ...PLAN,
      tools: [PLAN.tools[0]!, { ...PLAN.tools[1]!, name: PLAN.tools[0]!.name }],
    };
    await expect(renderAgenticProject(bad)).rejects.toThrow(/duplicate tool name/);
  });

  it("rejects a plan whose parameter name collides with a Python keyword", async () => {
    const bad: PlanProposal = {
      ...PLAN,
      tools: [
        {
          ...PLAN.tools[0]!,
          inputs: [
            {
              name: "class",
              type: "string",
              required: true,
              description: "bad",
            },
          ],
        },
        PLAN.tools[1]!,
      ],
    };
    await expect(renderAgenticProject(bad)).rejects.toThrow(/parameter class/);
  });

  it("README lists the tool catalog and verification checklist", async () => {
    const files = await renderAgenticProject(PLAN);
    const readme = files["README.md"]!;
    expect(readme).toContain("get_order");
    expect(readme).toContain("list_shipments");
    expect(readme).toContain("Tool names are verb_noun");
  });
});
