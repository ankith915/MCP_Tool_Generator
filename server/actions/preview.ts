"use server";

import { getCurrentUser } from "@/lib/auth";
import { renderProject } from "@/server/services/generate";
import { wizardConfigSchema } from "@/lib/schemas/wizard";
import { ErrorCodes, type ApiResult } from "@/lib/errors";

export async function previewAction(
  rawConfig: unknown,
): Promise<ApiResult<{ code: string }>> {
  await getCurrentUser();

  const parsed = wizardConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
        message: "Invalid configuration",
        details: parsed.error.issues,
      },
    };
  }

  try {
    const files = await renderProject(parsed.data);
    const { language, framework } = parsed.data;
    let primaryFile: string;
    if (language === "python" && framework === "fastapi-mcp") {
      primaryFile = "main.py";
    } else if (language === "python") {
      primaryFile = "server.py";
    } else {
      primaryFile = "src/index.ts";
    }
    const code = files[primaryFile] ?? "";
    return { ok: true, data: { code } };
  } catch (err) {
    void err;
    return {
      ok: false,
      error: { code: ErrorCodes.INTERNAL_ERROR, message: "Preview failed" },
    };
  }
}
