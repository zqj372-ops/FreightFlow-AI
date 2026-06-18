import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";

import {
  ensureStoredFileExists,
  getShipmentAttachment,
} from "@/lib/services/storage/attachment-storage-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ attachmentId: string; id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { attachmentId, id } = await context.params;

  try {
    const result = await getShipmentAttachment(id, attachmentId);
    if (!result) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const filePath = await ensureStoredFileExists(result.data);
    const content = await readFile(/*turbopackIgnore: true*/ filePath);

    return new NextResponse(content, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.data.originalName)}`,
        "Content-Length": String(content.byteLength),
        "Content-Type": result.data.mimeType,
      },
    });
  } catch (error) {
    console.error(`GET /api/shipments/${id}/attachments/${attachmentId}/download failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download attachment." },
      { status: 500 },
    );
  }
}
