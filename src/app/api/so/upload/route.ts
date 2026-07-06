import { NextRequest, NextResponse } from "next/server";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

type UploadBody = {
  fileName?: string;
  mimeType?: string;
  shipmentId?: string;
  sourceText?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as UploadBody;
  const shipmentId = body.shipmentId?.trim();
  const fileName = body.fileName?.trim() || "uploaded-so.txt";
  const mimeType = body.mimeType?.trim() || "text/plain";
  const sourceText = body.sourceText?.trim() || null;

  if (!shipmentId) {
    return NextResponse.json({ error: "shipmentId is required." }, { status: 400 });
  }

  try {
    const document = await prisma.soDocument.create({
      data: {
        shipmentId,
        fileName,
        mimeType,
        storagePath: `local-upload://${shipmentId}/${fileName}`,
        source: "UPLOAD",
        ocrStatus: sourceText ? "OCR_DONE" : "PENDING",
        rawText: sourceText,
      },
    });

    return NextResponse.json({ data: document, source: "database" }, { status: 201 });
  } catch (error) {
    if (!isPrismaUnavailable(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to upload SO document." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        id: `local-${Date.now()}`,
        shipmentId,
        fileName,
        mimeType,
        source: "UPLOAD",
        ocrStatus: sourceText ? "OCR_DONE" : "PENDING",
        rawText: sourceText,
      },
      source: "local",
      warning: "Database unavailable; returned local SO document preview.",
    }, { status: 201 });
  }
}
