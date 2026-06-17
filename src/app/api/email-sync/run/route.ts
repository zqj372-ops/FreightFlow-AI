import { NextResponse } from "next/server";

import { runEmailRecognitionSyncWithFallback } from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await request.json().catch(() => ({}));
  } catch {
    // Empty body / non-JSON is fine — defaults apply.
  }

  try {
    const result = await runEmailRecognitionSyncWithFallback();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/email-sync/run failed", error);
    return NextResponse.json(
      {
        error: "Failed to sync email messages.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
