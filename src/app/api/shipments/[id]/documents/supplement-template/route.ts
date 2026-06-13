import { NextRequest, NextResponse } from "next/server";

import { generateSupplementTemplate } from "@/lib/services/documents/document-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: shipmentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    templateType?: unknown;
    language?: unknown;
    shipment?: unknown;
  };

  const result = await generateSupplementTemplate({
    shipmentId,
    templateType: body.templateType === "customer" ? "customer" : "agent",
    language: body.language === "en" ? "en" : "zh-CN",
    shipment: body.shipment && typeof body.shipment === "object" ? (body.shipment as Record<string, unknown>) : null,
  });

  return NextResponse.json(result);
}
