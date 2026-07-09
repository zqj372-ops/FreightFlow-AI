import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import { runSoOcr } from "@/lib/so/so-ocr";

type OcrBody = {
  fileBase64?: string;
  fileDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  soDocumentId?: string;
  sourceText?: string;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as OcrBody;
  const persistentDocumentId =
    body.soDocumentId && !body.soDocumentId.startsWith("local-") ? body.soDocumentId : null;

  if (persistentDocumentId) {
    try {
      await prisma.soDocument.update({
        where: { id: persistentDocumentId },
        data: { ocrStatus: "OCR_PROCESSING", status: "RECEIVED" },
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO OCR status update skipped", error);
    }
  }

  const result = await runSoOcr(body);

  if (persistentDocumentId) {
    try {
      await prisma.soDocument.update({
        where: { id: persistentDocumentId },
        data: {
          rawText: result.rawText || undefined,
          ocrStatus: result.status === "OCR_DONE" ? "OCR_DONE" : "FAILED",
          status: result.status === "OCR_DONE" ? "RECEIVED" : "FAILED",
          ...(result.status === "FAILED" || result.status === "not_configured"
            ? {
                extractedJson: jsonValue({
                  error: result.message,
                  provider: result.provider ?? null,
                  status: result.status,
                }),
              }
            : {}),
        },
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO OCR persistence skipped", error);
    }
  }

  return NextResponse.json({ data: result });
}
