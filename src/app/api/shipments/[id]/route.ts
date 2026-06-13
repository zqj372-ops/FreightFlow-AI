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
      const error = repos.mode === "mock" ? "Shipment not found in mock fallback." : "Shipment not found.";
      return NextResponse.json({ error }, { status: 404 });
    }

    if (repos.mode === "prisma") {
      return NextResponse.json({ data, source: "database" });
    }
    return NextResponse.json({
      data,
      source: "mock",
      warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock shipment.",
    });
  } catch (error) {
    console.error(`GET /api/shipments/${id} failed`, error);
    return NextResponse.json({ error: "Failed to load shipment." }, { status: 500 });
  }
}
