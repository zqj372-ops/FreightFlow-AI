import { NextRequest, NextResponse } from "next/server";

import { getMockShipment, getShipmentFromDatabase, isPrismaUnavailable } from "@/lib/freightflow-data";
import { generateSupplementTemplate } from "@/lib/services/documents/document-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function downloadHeaders(fileName: string, mimeType: string) {
  return {
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Content-Type": mimeType,
  };
}

function toArrayBuffer(content: Uint8Array) {
  const body = new ArrayBuffer(content.byteLength);
  new Uint8Array(body).set(content);
  return body;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: shipmentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    templateType?: unknown;
    language?: unknown;
    shipment?: unknown;
  };

  let shipment = body.shipment && typeof body.shipment === "object" ? (body.shipment as Record<string, unknown>) : null;

  if (!shipment) {
    try {
      shipment = await getShipmentFromDatabase(shipmentId);
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
      shipment = getMockShipment(shipmentId);
    }
  }

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }

  const result = await generateSupplementTemplate({
    shipmentId,
    templateType: body.templateType === "customer" ? "customer" : "agent",
    language: body.language === "en" ? "en" : "zh-CN",
    shipment,
  });

  return new NextResponse(new Blob([toArrayBuffer(result.content)], { type: result.mimeType }), {
    headers: downloadHeaders(result.fileName, result.mimeType),
  });
}
