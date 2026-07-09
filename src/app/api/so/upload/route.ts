import { NextRequest, NextResponse } from "next/server";
import { ActionSource, Prisma, ShipmentActionType } from "@prisma/client";

import { applyShipmentAction } from "@/lib/freightflow-domain";
import { isPrismaUnavailable, shipmentInclude, shipmentUpdateData, toShipmentRecord } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import {
  buildMockSoDocumentCenterRecords,
  soDocumentCenterInclude,
  toSoDocumentCenterRecord,
} from "@/lib/so/so-document-center";
import type { SoDocumentStatusBucket } from "@/lib/so/so-types";

type UploadBody = {
  fileName?: string;
  mimeType?: string;
  shipmentId?: string;
  sourceText?: string;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const dynamic = "force-dynamic";

function normalizeBucket(value: string | null): SoDocumentStatusBucket | null {
  if (value === "applied" || value === "failed" || value === "pending" || value === "review") return value;

  return null;
}

export async function GET(request: NextRequest) {
  const bucket = normalizeBucket(request.nextUrl.searchParams.get("bucket"));

  try {
    const documents = await prisma.soDocument.findMany({
      include: soDocumentCenterInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    const data = documents.map(toSoDocumentCenterRecord).filter((document) => !bucket || document.statusBucket === bucket);

    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      const data = buildMockSoDocumentCenterRecords().filter((document) => !bucket || document.statusBucket === bucket);

      return NextResponse.json({
        data,
        source: "mock",
        warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock SO documents.",
      });
    }

    console.error("GET /api/so/upload failed", error);
    return NextResponse.json({ error: "Failed to load SO documents." }, { status: 500 });
  }
}

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
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.shipment.findUnique({ where: { id: shipmentId }, include: shipmentInclude });
      if (!before) return null;

      const beforeRecord = toShipmentRecord(before);
      const action = applyShipmentAction(beforeRecord, { action: "SO 识别", soStage: "received", source: "SYSTEM" });
      const after = await tx.shipment.update({
        where: { id: shipmentId },
        data: shipmentUpdateData(action.record),
        include: shipmentInclude,
      });
      const afterRecord = toShipmentRecord(after);
      const document = await tx.soDocument.create({
        data: {
          shipmentId,
          fileName,
          mimeType,
          storagePath: `local-upload://${shipmentId}/${fileName}`,
          source: "UPLOAD",
          ocrStatus: sourceText ? "OCR_DONE" : "PENDING",
          status: "RECEIVED",
          rawText: sourceText,
        },
      });
      const actionLog = await tx.shipmentActionLog.create({
        data: {
          shipmentId,
          actionType: ShipmentActionType.SO_RECEIVED,
          source: ActionSource.SYSTEM,
          summary: action.summary,
          beforeSnapshot: jsonValue(beforeRecord),
          afterSnapshot: jsonValue(afterRecord),
        },
      });

      return { actionLog, document, shipment: afterRecord };
    });

    if (!result) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });

    return NextResponse.json(
      {
        data: {
          ...result.document,
          actionLogId: result.actionLog.id,
          shipment: result.shipment,
        },
        source: "database",
      },
      { status: 201 },
    );
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
        status: "RECEIVED",
        rawText: sourceText,
      },
      source: "local",
      warning: "Database unavailable; returned local SO document preview.",
    }, { status: 201 });
  }
}
