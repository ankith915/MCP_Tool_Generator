import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ErrorCodes, type ApiResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  extractDocument,
  kindForFilename,
  MAX_EXTRACTED_CHARS,
} from "@/lib/agents/extract-document";

const RL_MAX = 20;
const RL_WINDOW_MS = 60 * 60 * 1000;

/** 5 MiB. Larger PDFs are usually deck-style and rarely useful for tool design;
 * extraction time also grows linearly. Tweak if you see real demand. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SUPPORTED_EXT_LABEL = ".pdf, .docx, .md, .txt";

export interface UploadResponse {
  filename: string;
  size: number;
  text: string;
  redactedCount: number;
  wasTruncated: boolean;
  rawCharCount: number;
  maxChars: number;
}

function error(
  code: keyof typeof ErrorCodes,
  message: string,
  status: number,
): NextResponse<ApiResult<UploadResponse>> {
  return NextResponse.json(
    { ok: false, error: { code: ErrorCodes[code], message } },
    { status },
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResult<UploadResponse>>> {
  const user = await getCurrentUser(request);

  const rl = await rateLimit.check(`upload:${user.id}`, RL_MAX, RL_WINDOW_MS);
  if (!rl.allowed) {
    return error(
      "RATE_LIMITED",
      `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}`,
      429,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error("VALIDATION_FAILED", "Invalid multipart body", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return error("VALIDATION_FAILED", "Missing 'file' field", 400);
  }

  if (file.size === 0) {
    return error("VALIDATION_FAILED", "File is empty", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return error(
      "VALIDATION_FAILED",
      `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MiB limit`,
      400,
    );
  }

  if (!kindForFilename(file.name)) {
    return error(
      "VALIDATION_FAILED",
      `Unsupported file type. Allowed: ${SUPPORTED_EXT_LABEL}`,
      400,
    );
  }

  let extracted;
  try {
    const buffer = await file.arrayBuffer();
    extracted = await extractDocument(file.name, buffer);
  } catch (err) {
    logger.warn({
      event: "chat.upload.extract_failed",
      userId: user.id,
      err: (err as Error).message,
    });
    return error(
      "VALIDATION_FAILED",
      "Could not extract text from the file — it may be corrupt or password-protected",
      400,
    );
  }

  logger.info({
    event: "chat.upload.extracted",
    userId: user.id,
    bytes: file.size,
    chars: extracted.text.length,
    redactedCount: extracted.redactedCount,
    truncated: extracted.wasTruncated,
  });

  return NextResponse.json({
    ok: true,
    data: {
      filename: file.name,
      size: file.size,
      text: extracted.text,
      redactedCount: extracted.redactedCount,
      wasTruncated: extracted.wasTruncated,
      rawCharCount: extracted.rawCharCount,
      maxChars: MAX_EXTRACTED_CHARS,
    },
  });
}
