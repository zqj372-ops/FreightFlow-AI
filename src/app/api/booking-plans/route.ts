import { NextResponse } from "next/server";

import { listBookingPlansWithFallback } from "@/lib/services/booking-plans/booking-plan-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await listBookingPlansWithFallback();
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/booking-plans failed", error);
    return NextResponse.json({ error: "Failed to load booking plans." }, { status: 500 });
  }
}
