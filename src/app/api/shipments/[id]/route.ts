import { NextResponse, type NextRequest } from "next/server";

import { getMockShipment, getShipmentFromDatabase, isPrismaUnavailable, updateShipmentInDatabase } from "@/lib/freightflow-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const data = await getShipmentFromDatabase(id);

    if (!data) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }

    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      const data = getMockShipment(id);

      if (!data) {
        return NextResponse.json({ error: "Shipment not found in mock fallback." }, { status: 404 });
      }

      return NextResponse.json({
        data,
        source: "mock",
        warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock shipment.",
      });
    }

    console.error(`GET /api/shipments/${id} failed`, error);
    return NextResponse.json({ error: "Failed to load shipment." }, { status: 500 });
  }
}

async function updateShipment(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await updateShipmentInDatabase(id, await request.json().catch(() => null));

    if ("notFound" in result) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result, source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json(
        { error: "Database is unavailable; updating shipments requires PostgreSQL persistence." },
        { status: 503 },
      );
    }

    console.error(`PATCH /api/shipments/${id} failed`, error);
    return NextResponse.json({ error: "Failed to update shipment." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return updateShipment(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return updateShipment(request, context);
}
