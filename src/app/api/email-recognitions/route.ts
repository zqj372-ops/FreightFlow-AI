import { NextResponse, type NextRequest } from "next/server";

import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

/**
 * List pending email recognitions for the SO identification queue.
 *
 * GET /api/email-recognitions
 *   → 200 { data: RecognitionWithEmail[], source: "database" | "mock" }
 *   → 500 on internal failure
 *
 * The route delegates to `EmailRecognitionRepository.listPending()` so
 * the workbench can show the latest unreviewed recognitions regardless
 * of whether the underlying data layer is Prisma or the in-memory
 * mock store.
 */
export async function GET(_request: NextRequest) {
  try {
    const repos = await getRepositories();
    const data = await repos.emailRecognitions.listPending();
    return NextResponse.json({ data, source: repos.mode === "prisma" ? "database" : "mock" });
  } catch (error) {
    console.error("GET /api/email-recognitions failed", error);
    return NextResponse.json({ error: "Failed to load email recognitions." }, { status: 500 });
  }
}
