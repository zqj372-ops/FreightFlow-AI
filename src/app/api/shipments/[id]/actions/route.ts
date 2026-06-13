import { NextResponse, type NextRequest } from "next/server";

import {
  getMockShipment,
  isPrismaUnavailable,
  normalizeShipmentAction,
  persistShipmentAction,
} from "@/lib/freightflow-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsed = normalizeShipmentAction(await request.json().catch(() => null));

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await persistShipmentAction(id, parsed.value);

    if (!result) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }

    return NextResponse.json({ data: result, source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      const fallback = getMockShipment(id);

      return NextResponse.json(
        {
          error: "Database is unavailable; shipment actions require PostgreSQL persistence.",
          fallbackShipment: fallback,
          source: "mock",
        },
        { status: 503 },
      );
    }

    console.error(`POST /api/shipments/${id}/actions failed`, error);
    return NextResponse.json({ error: "Failed to persist shipment action." }, { status: 500 });
  }
}
