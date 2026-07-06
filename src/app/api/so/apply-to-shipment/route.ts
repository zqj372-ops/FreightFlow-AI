import { NextRequest, NextResponse } from "next/server";
import { ActionSource, Prisma, ShipmentActionType } from "@prisma/client";

import {
  getMockShipment,
  getShipmentFromDatabase,
  isPrismaUnavailable,
  shipmentInclude,
  shipmentUpdateData,
  toShipmentRecord,
} from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import { applyReviewPatches, applySoExtractionToShipment } from "@/lib/so/so-field-mapper";
import { extractionFromStoredDocument } from "@/lib/so/so-document-center";
import { extractSoFields } from "@/lib/so/so-extractor";
import { soFieldKeys, type SoExtractionResult, type SoFieldKey, type SoFieldReviewPatch } from "@/lib/so/so-types";

type ApplyBody = {
  actorEmail?: string;
  actorName?: string;
  confirmedFieldKeys?: string[];
  extraction?: SoExtractionResult;
  fieldOverrides?: SoFieldReviewPatch[];
  rawText?: string;
  shipmentId?: string;
  soDocumentId?: string;
  source?: string;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadShipment(shipmentId: string) {
  try {
    return await getShipmentFromDatabase(shipmentId);
  } catch (error) {
    if (isPrismaUnavailable(error)) return getMockShipment(shipmentId);
    throw error;
  }
}

function normalizeFieldKey(value: unknown): SoFieldKey | null {
  return typeof value === "string" && soFieldKeys.includes(value as SoFieldKey) ? (value as SoFieldKey) : null;
}

function normalizeReviewPatches(value: unknown): SoFieldReviewPatch[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;
    const fieldKey = normalizeFieldKey(record.fieldKey);
    if (!fieldKey) return [];

    return {
      apply: typeof record.apply === "boolean" ? record.apply : undefined,
      confidence: typeof record.confidence === "number" ? record.confidence : undefined,
      confirmed: typeof record.confirmed === "boolean" ? record.confirmed : undefined,
      fieldKey,
      sourceText: typeof record.sourceText === "string" ? record.sourceText : undefined,
      value: typeof record.value === "string" ? record.value : record.value === null ? null : undefined,
    };
  });
}

function normalizeConfirmedFieldKeys(value: unknown): SoFieldKey[] {
  if (!Array.isArray(value)) return [];

  return value.map(normalizeFieldKey).filter((fieldKey): fieldKey is SoFieldKey => Boolean(fieldKey));
}

function normalizeActionSource(value: unknown) {
  if (value === ActionSource.AI || value === ActionSource.SYSTEM || value === ActionSource.UI) return value;

  return ActionSource.UI;
}

async function loadExtractionFromDocument(soDocumentId: string) {
  const document = await prisma.soDocument.findUnique({
    where: { id: soDocumentId },
    include: { extractedFields: true },
  });

  return document ? extractionFromStoredDocument(document) : null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ApplyBody;
  const shipmentId = body.shipmentId?.trim();
  const persistentDocumentId =
    body.soDocumentId && !body.soDocumentId.startsWith("local-") ? body.soDocumentId : null;

  if (!shipmentId) return NextResponse.json({ error: "shipmentId is required." }, { status: 400 });

  const shipment = await loadShipment(shipmentId);
  if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });

  let extraction = body.extraction ?? null;
  if (!extraction && persistentDocumentId) {
    try {
      extraction = await loadExtractionFromDocument(persistentDocumentId);
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  if (!extraction && body.rawText?.trim()) {
    extraction = extractSoFields(body.rawText);
  }

  if (!extraction) {
    return NextResponse.json(
      { error: "extraction, rawText, or a SO document with extracted fields is required." },
      { status: 400 },
    );
  }

  const fieldOverrides = normalizeReviewPatches(body.fieldOverrides);
  const confirmedFieldKeys = normalizeConfirmedFieldKeys(body.confirmedFieldKeys);
  const reviewedExtraction = applyReviewPatches(extraction, fieldOverrides);
  const reviewedApplyResult = applySoExtractionToShipment(shipment, extraction, {
    confirmedFieldKeys,
    fieldOverrides,
  });
  const appliedAt = new Date().toISOString();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.shipment.findUnique({ where: { id: shipmentId }, include: shipmentInclude });
      if (!before) return null;

      const beforeRecord = toShipmentRecord(before);
      const after = await tx.shipment.update({
        where: { id: shipmentId },
        data: shipmentUpdateData(reviewedApplyResult.shipment),
        include: shipmentInclude,
      });
      const afterRecord = toShipmentRecord(after);
      const actionLog = await tx.shipmentActionLog.create({
        data: {
          shipmentId,
          actionType: ShipmentActionType.SO_APPLIED,
          source: normalizeActionSource(body.source),
          actorName: body.actorName?.trim() || null,
          actorEmail: body.actorEmail?.trim() || null,
          summary: `SO extraction applied ${reviewedApplyResult.appliedFields.length} fields; skipped ${reviewedApplyResult.skippedFields.length}.`,
          beforeSnapshot: jsonValue(beforeRecord),
          afterSnapshot: jsonValue(afterRecord),
        },
      });
      const appliedDocument = persistentDocumentId
        ? { id: persistentDocumentId }
        : await tx.soDocument.findFirst({
            where: { shipmentId },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });

      if (appliedDocument) {
        await tx.soDocument.update({
          where: { id: appliedDocument.id },
          data: {
            confidence: reviewedExtraction.confidence,
            extractedJson: jsonValue({
              ...reviewedExtraction,
              actionLogId: actionLog.id,
              appliedAt,
              appliedFields: reviewedApplyResult.appliedFields,
              skippedFields: reviewedApplyResult.skippedFields,
            }),
            ocrStatus: "EXTRACTED",
            status: "APPLIED",
          },
        });
        await tx.soExtractedField.deleteMany({ where: { soDocumentId: appliedDocument.id } });
        await tx.soExtractedField.createMany({
          data: reviewedExtraction.fields.map((field) => ({
            soDocumentId: appliedDocument.id,
            fieldKey: field.fieldKey,
            fieldValue: field.value,
            confidence: field.confidence,
            sourceText: field.sourceText,
          })),
        });
      }

      return { actionLog, shipment: afterRecord, soDocumentId: appliedDocument?.id ?? null };
    });

    return NextResponse.json({
      data: {
        ...reviewedApplyResult,
        actionLogId: result?.actionLog.id ?? null,
        appliedAt,
        persisted: Boolean(result),
        shipment: result?.shipment ?? reviewedApplyResult.shipment,
        soDocumentId: result?.soDocumentId ?? persistentDocumentId,
      },
      source: "database",
    });
  } catch (error) {
    if (!isPrismaUnavailable(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to apply SO extraction." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        ...reviewedApplyResult,
        actionLogId: null,
        appliedAt,
        persisted: false,
        soDocumentId: persistentDocumentId,
      },
      source: "mock",
      warning: "Database unavailable; returned local Shipment update preview.",
    });
  }
}
