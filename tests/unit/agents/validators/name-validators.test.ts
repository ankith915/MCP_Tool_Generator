import { describe, it, expect } from "vitest";
import {
  serverNameValidator,
  toolNameValidator,
  parameterNameValidator,
} from "@/lib/agents/validators/name-validators";

describe("serverNameValidator", () => {
  it("accepts a valid name", () => {
    expect(serverNameValidator("deployments-mcp")).toEqual({ ok: true });
    expect(serverNameValidator("customer-lookup-mcp")).toEqual({ ok: true });
  });

  it("rejects names without the -mcp suffix", () => {
    const r = serverNameValidator("deployments");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.code).toBe("SERVER_NAME_INVALID");
  });

  it("rejects uppercase characters", () => {
    const r = serverNameValidator("Deployments-MCP");
    expect(r.ok).toBe(false);
  });

  it("rejects underscores (must be hyphens)", () => {
    const r = serverNameValidator("deployments_mcp");
    expect(r.ok).toBe(false);
  });

  it("rejects names starting with a digit", () => {
    const r = serverNameValidator("1-deployments-mcp");
    expect(r.ok).toBe(false);
  });

  it("violation references playbook §7.1", () => {
    const r = serverNameValidator("bad");
    if (!r.ok) expect(r.violation.section).toBe("§7.1");
  });
});

describe("toolNameValidator", () => {
  it("accepts snake_case verb_noun names", () => {
    expect(toolNameValidator("get_deployment_status", "name")).toEqual({ ok: true });
    expect(toolNameValidator("list_users", "name")).toEqual({ ok: true });
  });

  it("rejects camelCase", () => {
    const r = toolNameValidator("getDeploymentStatus", "name");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.code).toBe("TOOL_NAME_INVALID");
  });

  it("rejects names starting with a digit", () => {
    const r = toolNameValidator("1_tool", "name");
    expect(r.ok).toBe(false);
  });

  it("flags banned manage_ prefix as god-tool", () => {
    const r = toolNameValidator("manage_deployments", "name");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.code).toBe("TOOL_NAME_BANNED_PREFIX");
      expect(r.violation.section).toBe("§A3");
    }
  });

  it("flags banned do_ prefix", () => {
    const r = toolNameValidator("do_thing", "name");
    if (!r.ok) expect(r.violation.code).toBe("TOOL_NAME_BANNED_PREFIX");
  });

  it("flags banned handle_ prefix", () => {
    const r = toolNameValidator("handle_request", "name");
    if (!r.ok) expect(r.violation.code).toBe("TOOL_NAME_BANNED_PREFIX");
  });

  it("flags banned process_ prefix", () => {
    const r = toolNameValidator("process_data", "name");
    if (!r.ok) expect(r.violation.code).toBe("TOOL_NAME_BANNED_PREFIX");
  });

  it("flags bare 'do' / 'manage' as god-tools", () => {
    expect(toolNameValidator("do", "name").ok).toBe(false);
    expect(toolNameValidator("manage", "name").ok).toBe(false);
  });
});

describe("parameterNameValidator", () => {
  it("accepts snake_case", () => {
    expect(parameterNameValidator("service_id", "p")).toEqual({ ok: true });
  });

  it("rejects camelCase", () => {
    const r = parameterNameValidator("serviceId", "p");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.section).toBe("§7.4");
  });

  it("rejects leading digit", () => {
    expect(parameterNameValidator("2nd", "p").ok).toBe(false);
  });
});
