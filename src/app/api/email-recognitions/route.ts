import { NextResponse } from "next/server";

import { getRepositories } from "@/lib/repositories";
import { listMockEmailRecognitionQueue } from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = await getRepositories();
    if (repos.mode === "mock") {
      return NextResponse.json({ data: listMockEmailRecognitionQueue(), source: "mock" });
    }
    const data = await repos.emailRecognitions.listPending();
    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    console.error("GET /api/email-recognitions failed", error);
    return NextResponse.json({ error: "Failed to load email recognitions." }, { status: 500 });
  }
}
