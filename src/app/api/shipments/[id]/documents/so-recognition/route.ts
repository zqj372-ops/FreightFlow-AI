import { NextRequest, NextResponse } from "next/server";

import { recognizeShippingOrder } from "@/lib/services/documents/document-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: shipmentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    fileName?: unknown;
    mimeType?: unknown;
    sourceText?: unknown;
  };

  const result = await recognizeShippingOrder({
    shipmentId,
    fileName: typeof body.fileName === "string" ? body.fileName : null,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    sourceText: typeof body.sourceText === "string" ? body.sourceText : null,
  });

  return NextResponse.json(result);
}
