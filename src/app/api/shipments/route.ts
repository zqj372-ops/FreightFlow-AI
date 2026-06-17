import { NextResponse } from "next/server";

import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = await getRepositories();
    const data = await repos.shipments.list();
    if (repos.mode === "prisma") {
      return NextResponse.json({ data, source: "database" });
    }
    return NextResponse.json({
      data,
      source: "mock",
      warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock shipments.",
    });
  } catch (error) {
    console.error("GET /api/shipments failed", error);
    return NextResponse.json({ error: "Failed to load shipments." }, { status: 500 });
  }
}
