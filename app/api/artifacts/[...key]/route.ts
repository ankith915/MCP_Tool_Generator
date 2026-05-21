import { type NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key } = await params;
  const artifactKey = key.join("/");

  const data = await storage.get(artifactKey);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filename = key[key.length - 1] ?? "artifact.zip";
  return new NextResponse(data.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
