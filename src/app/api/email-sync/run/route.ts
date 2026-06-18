import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/prisma";
import { runSync } from "@/lib/services/email/email-service";
import type { RunSyncOptions } from "@/lib/services/email/types";
import {
  createRecognitionFromEmailMessage,
  listEmailRecognitionQueue,
  runEmailRecognitionSyncWithFallback,
} from "@/lib/services/email-recognition/email-recognition-service";

export const dynamic = "force-dynamic";

type RunSyncRequestBody = Partial<RunSyncOptions>;

function parseRunSyncBody(value: unknown): RunSyncOptions {
  if (!value || typeof value !== "object") return {};
  const body = value as RunSyncRequestBody;

  return {
    fullSync: typeof body.fullSync === "boolean" ? body.fullSync : undefined,
    limit: typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0 ? body.limit : undefined,
    mailbox: typeof body.mailbox === "string" && body.mailbox.trim() ? body.mailbox.trim() : undefined,
  };
}

export async function POST(request: Request) {
  let options: RunSyncOptions = {};

  try {
    const raw = await request.json().catch(() => ({}));
    options = parseRunSyncBody(raw);
  } catch {
    // Empty body / non-JSON is fine — defaults apply.
  }

  try {
    if (isDatabaseConfigured()) {
      const report = await runSync(options, {
        triggerRecognition: async (emailMessageId) => {
          await createRecognitionFromEmailMessage(emailMessageId);
        },
      });
      const recognitions = await listEmailRecognitionQueue();
      return NextResponse.json({
        data: {
          duplicateCount: report.duplicatesSkipped,
          importedCount: report.newInserted,
          recognitions,
        },
        report,
        source: "database",
      });
    }

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
