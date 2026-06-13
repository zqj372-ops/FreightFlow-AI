import { NextRequest, NextResponse } from "next/server";

import {
  listShipmentEmailLogs,
  parseShipmentEmailInput,
  sendShipmentEmail,
} from "@/lib/services/email/email-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected email service error";
}

function isValidationError(error: unknown) {
  return error instanceof Error && /missing|invalid|required/i.test(error.message);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: shipmentId } = await context.params;

  try {
    const emailLogs = await listShipmentEmailLogs(shipmentId);

    return NextResponse.json({
      shipmentId,
      emailLogs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: errorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: shipmentId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const input = parseShipmentEmailInput(shipmentId, body);
    const result = await sendShipmentEmail(input);

    return NextResponse.json({
      shipmentId,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: errorMessage(error),
      },
      { status: isValidationError(error) ? 400 : 500 },
    );
  }
}
