import { NextResponse, type NextRequest } from "next/server";

import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const repos = await getRepositories();
    const data = await repos.shipments.getById(id);

    if (!data) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }

    return NextResponse.json({ data, source: repos.mode === "prisma" ? "database" : "mock" });
  } catch (error) {
    console.error(`GET /api/shipments/${id} failed`, error);
    return NextResponse.json({ error: "Failed to load shipment." }, { status: 500 });
  }
}
