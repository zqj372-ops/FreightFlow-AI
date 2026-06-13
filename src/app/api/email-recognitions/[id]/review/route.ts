import { NextRequest, NextResponse } from "next/server";

import {
  confirmEmailRecognition,
  ignoreEmailRecognition,
  markEmailRecognitionException,
} from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

type ReviewAction = "confirm" | "ignore" | "mark_exception";

function normalizeAction(value: unknown): ReviewAction | null {
  return value === "confirm" || value === "ignore" || value === "mark_exception" ? value : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; reviewer?: unknown };
    const action = normalizeAction(body.action);

    if (!action) {
      return NextResponse.json({ error: "action must be confirm, ignore, or mark_exception." }, { status: 400 });
    }

    const reviewer = typeof body.reviewer === "string" ? body.reviewer : undefined;
    const input = { reviewer };
    const data =
      action === "confirm"
        ? await confirmEmailRecognition(id, input)
        : action === "ignore"
          ? await ignoreEmailRecognition(id, input)
          : await markEmailRecognitionException(id, input);

    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    console.error("POST /api/email-recognitions/[id]/review failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review email recognition." },
      { status: 500 },
    );
  }
}
