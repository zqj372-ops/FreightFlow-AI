import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import { enhanceSoExtractionWithOpenClaw } from "@/lib/so/so-ai-extractor";
import { extractSoFields } from "@/lib/so/so-extractor";
import { validateSoExtraction } from "@/lib/so/so-validator";

type ExtractBody = {
  rawText?: string;
  soDocumentId?: string;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ExtractBody;
  let rawText = body.rawText?.trim() ?? "";

  if (!rawText && body.soDocumentId && !body.soDocumentId.startsWith("local-")) {
    try {
      const document = await prisma.soDocument.findUnique({
        where: { id: body.soDocumentId },
        select: { rawText: true },
      });
      rawText = document?.rawText?.trim() ?? "";
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  if (!rawText) {
    return NextResponse.json({ error: "rawText is required before SO extraction." }, { status: 400 });
  }

  const localExtraction = extractSoFields(rawText);
  const extraction = await enhanceSoExtractionWithOpenClaw(rawText, localExtraction);
  const validation = validateSoExtraction(extraction);

  if (body.soDocumentId && !body.soDocumentId.startsWith("local-")) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.soDocument.update({
          where: { id: body.soDocumentId },
          data: {
            confidence: extraction.confidence,
            extractedJson: jsonValue(extraction),
            ocrStatus: extraction.status,
          },
        });
        await tx.soExtractedField.deleteMany({ where: { soDocumentId: body.soDocumentId } });
        await tx.soExtractedField.createMany({
          data: extraction.fields.map((field) => ({
            soDocumentId: body.soDocumentId ?? "",
            fieldKey: field.fieldKey,
            fieldValue: field.value,
            confidence: field.confidence,
            sourceText: field.sourceText,
          })),
        });
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO extraction persistence skipped", error);
    }
  }

  return NextResponse.json({ data: { extraction, validation } });
}
