import { NextResponse, type NextRequest } from "next/server";

import { isDatabaseConfigured } from "@/lib/prisma";
import { getEmailDraft, updateEmailDraft } from "@/lib/services/booking-plans/booking-plan-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;

  try {
    const draft = await getEmailDraft(draftId);

    if (!draft) {
      return NextResponse.json({ error: "Email draft not found." }, { status: 404 });
    }

    return NextResponse.json({ data: draft, source: isDatabaseConfigured() ? "database" : "mock" });
  } catch (error) {
    console.error(`GET /api/email-drafts/${draftId} failed`, error);
    return NextResponse.json({ error: "Failed to load email draft." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const draft = await updateEmailDraft(draftId, body);
    return NextResponse.json({ data: draft, source: isDatabaseConfigured() ? "database" : "mock" });
  } catch (error) {
    console.error(`PATCH /api/email-drafts/${draftId} failed`, error);
    return NextResponse.json({ error: "Failed to update email draft." }, { status: 500 });
  }
}
