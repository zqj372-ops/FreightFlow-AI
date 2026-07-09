import { NextRequest, NextResponse } from "next/server";
import { ActionSource, Prisma, ShipmentActionType } from "@prisma/client";

import { applyShipmentAction } from "@/lib/freightflow-domain";
import { isPrismaUnavailable, shipmentInclude, shipmentUpdateData, toShipmentRecord } from "@/lib/freightflow-data";
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
  const persistentDocumentId =
    body.soDocumentId && !body.soDocumentId.startsWith("local-") ? body.soDocumentId : null;

  if (persistentDocumentId) {
    try {
      await prisma.soDocument.update({
        where: { id: persistentDocumentId },
        data: { ocrStatus: "EXTRACTING", status: "RECEIVED" },
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO extraction status update skipped", error);
    }
  }

  if (!rawText && persistentDocumentId) {
    try {
      const document = await prisma.soDocument.findUnique({
        where: { id: persistentDocumentId },
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
  const reviewedExtraction = {
    ...extraction,
    status: validation.canAutoApply ? extraction.status : "NEED_REVIEW",
  } satisfies typeof extraction;

  if (persistentDocumentId) {
    try {
      await prisma.$transaction(async (tx) => {
        const document = await tx.soDocument.update({
          where: { id: persistentDocumentId },
          data: {
            confidence: reviewedExtraction.confidence,
            extractedJson: jsonValue(reviewedExtraction),
            ocrStatus: reviewedExtraction.status,
            status: validation.canAutoApply ? "REVIEWED" : "NEED_REVIEW",
          },
          select: { shipmentId: true },
        });
        await tx.soExtractedField.deleteMany({ where: { soDocumentId: persistentDocumentId } });
        await tx.soExtractedField.createMany({
          data: reviewedExtraction.fields.map((field) => ({
            soDocumentId: persistentDocumentId,
            fieldKey: field.fieldKey,
            fieldValue: field.value,
            confidence: field.confidence,
            sourceText: field.sourceText,
          })),
        });

        if (!validation.canAutoApply) {
          const before = await tx.shipment.findUnique({ where: { id: document.shipmentId }, include: shipmentInclude });
          if (!before) return;

          const beforeRecord = toShipmentRecord(before);
          const action = applyShipmentAction(beforeRecord, { action: "SO 识别", soStage: "reviewing", source: "SYSTEM" });
          const after = await tx.shipment.update({
            where: { id: document.shipmentId },
            data: shipmentUpdateData(action.record),
            include: shipmentInclude,
          });
          await tx.shipmentActionLog.create({
            data: {
              shipmentId: document.shipmentId,
              actionType: ShipmentActionType.SO_RECOGNITION,
              source: ActionSource.SYSTEM,
              summary: action.summary,
              beforeSnapshot: jsonValue(beforeRecord),
              afterSnapshot: jsonValue(toShipmentRecord(after)),
            },
          });
        }
      });
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("SO extraction persistence skipped", error);
    }
  }

  return NextResponse.json({ data: { extraction: reviewedExtraction, validation } });
}
