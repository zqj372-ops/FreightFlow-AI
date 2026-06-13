import { NextResponse, type NextRequest } from "next/server";

import { createBookingDraftBatchWithFallback } from "@/lib/services/booking-plans/booking-plan-service";

export const dynamic = "force-dynamic";

type BatchDraftRequest = {
  createdBy?: unknown;
  shipmentIds?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BatchDraftRequest;

  if (!Array.isArray(body.shipmentIds) || body.shipmentIds.length === 0) {
    return NextResponse.json({ error: "shipmentIds must be a non-empty array." }, { status: 400 });
  }

  const shipmentIds = body.shipmentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  if (shipmentIds.length === 0) {
    return NextResponse.json({ error: "shipmentIds must include at least one shipment id." }, { status: 400 });
  }

  try {
    const result = await createBookingDraftBatchWithFallback(
      shipmentIds,
      typeof body.createdBy === "string" ? body.createdBy : undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/booking-plans/batch-drafts failed", error);
    return NextResponse.json({ error: "Failed to generate booking drafts." }, { status: 500 });
  }
}
