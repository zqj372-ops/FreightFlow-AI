import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as OcrBody;
  const result = await runSoOcr(body);

  if (body.soDocumentId && !body.soDocumentId.startsWith("local-")) {
    try {
      await prisma.soDocument.update({
        where: { id: body.soDocumentId },
        data: {
          rawText: result.rawText || undefined,
          ocrStatus: result.status === "OCR_DONE" ? "OCR_DONE" : "FAILED",
        },
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO OCR persistence skipped", error);
    }
  }

  return NextResponse.json({ data: result });
}
