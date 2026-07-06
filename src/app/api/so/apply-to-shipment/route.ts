import { NextRequest, NextResponse } from "next/server";
import { ActionSource, ShipmentActionType } from "@prisma/client";

import {
  getMockShipment,
  getShipmentFromDatabase,
  isPrismaUnavailable,
  shipmentInclude,
  shipmentUpdateData,
  toShipmentRecord,
} from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import { applySoExtractionToShipment } from "@/lib/so/so-field-mapper";
import { extractSoFields } from "@/lib/so/so-extractor";
import type { SoExtractionResult } from "@/lib/so/so-types";

type ApplyBody = {
  extraction?: SoExtractionResult;
  rawText?: string;
  shipmentId?: string;
};

async function loadShipment(shipmentId: string) {
  try {
    return await getShipmentFromDatabase(shipmentId);
  } catch (error) {
    if (isPrismaUnavailable(error)) return getMockShipment(shipmentId);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ApplyBody;
  const shipmentId = body.shipmentId?.trim();

  if (!shipmentId) return NextResponse.json({ error: "shipmentId is required." }, { status: 400 });

  const shipment = await loadShipment(shipmentId);
  if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });

  const extraction = body.extraction ?? extractSoFields(body.rawText ?? "");
  const applyResult = applySoExtractionToShipment(shipment, extraction);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.shipment.findUnique({ where: { id: shipmentId }, include: shipmentInclude });
      if (!before) return null;

      const beforeRecord = toShipmentRecord(before);
      const after = await tx.shipment.update({
        where: { id: shipmentId },
        data: shipmentUpdateData(applyResult.shipment),
        include: shipmentInclude,
      });
      const afterRecord = toShipmentRecord(after);
      const actionLog = await tx.shipmentActionLog.create({
        data: {
          shipmentId,
          actionType: ShipmentActionType.SO_RECOGNITION,
          source: ActionSource.SYSTEM,
          summary: `SO extraction applied ${applyResult.appliedFields.length} fields; skipped ${applyResult.skippedFields.length}.`,
          beforeSnapshot: beforeRecord,
          afterSnapshot: afterRecord,
        },
      });

      return { actionLog, shipment: afterRecord };
    });

    return NextResponse.json({ data: { ...applyResult, persisted: Boolean(result), shipment: result?.shipment ?? applyResult.shipment }, source: "database" });
  } catch (error) {
    if (!isPrismaUnavailable(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to apply SO extraction." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { ...applyResult, persisted: false },
      source: "mock",
      warning: "Database unavailable; returned local Shipment update preview.",
    });
  }
}
