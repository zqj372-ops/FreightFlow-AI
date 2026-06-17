import { NextResponse, type NextRequest } from "next/server";

import { sendEmailDraft } from "@/lib/services/booking-plans/booking-plan-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;

  try {
    const result = await sendEmailDraft(draftId);

    if (!result) {
      return NextResponse.json({ error: "Email draft not found." }, { status: 404 });
    }

    return NextResponse.json({ data: result, source: "database" });
  } catch (error) {
    console.error(`POST /api/email-drafts/${draftId}/send failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email draft." },
      { status: 500 },
    );
  }
}
