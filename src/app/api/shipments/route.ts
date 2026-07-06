import { NextResponse, type NextRequest } from "next/server";

import { createShipmentInDatabase, isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listShipmentsFromDatabase();
    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json({
        data: mockShipments,
        source: "mock",
        warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock shipments.",
      });
    }

    console.error("GET /api/shipments failed", error);
    return NextResponse.json({ error: "Failed to load shipments." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await createShipmentInDatabase(await request.json().catch(() => null));

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result, source: "database" }, { status: 201 });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json(
        { error: "Database is unavailable; creating shipments requires PostgreSQL persistence." },
        { status: 503 },
      );
    }

    console.error("POST /api/shipments failed", error);
    return NextResponse.json({ error: "Failed to create shipment." }, { status: 500 });
  }
}
