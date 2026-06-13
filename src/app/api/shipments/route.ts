import { NextResponse } from "next/server";

import { isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";

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
