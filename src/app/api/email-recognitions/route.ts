import { NextResponse } from "next/server";

import { listEmailRecognitionQueueWithFallback } from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await listEmailRecognitionQueueWithFallback();
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/email-recognitions failed", error);
    return NextResponse.json({ error: "Failed to load email recognitions." }, { status: 500 });
  }
}
