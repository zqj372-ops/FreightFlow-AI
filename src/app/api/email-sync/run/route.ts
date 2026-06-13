import { NextResponse } from "next/server";

import { runEmailRecognitionSyncWithFallback } from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runEmailRecognitionSyncWithFallback();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/email-sync/run failed", error);
    return NextResponse.json({ error: "Failed to sync email recognitions." }, { status: 500 });
  }
}
