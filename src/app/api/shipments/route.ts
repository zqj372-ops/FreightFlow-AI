import { NextResponse } from "next/server";

import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = await getRepositories();
    const data = await repos.shipments.list();
    return NextResponse.json({ data, source: repos.mode === "prisma" ? "database" : "mock" });
  } catch (error) {
    console.error("GET /api/shipments failed", error);
    return NextResponse.json({ error: "Failed to load shipments." }, { status: 500 });
  }
}
