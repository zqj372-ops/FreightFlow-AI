import { NextResponse, type NextRequest } from "next/server";

import { getMockShipment, getShipmentFromDatabase, isPrismaUnavailable } from "@/lib/freightflow-data";

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
