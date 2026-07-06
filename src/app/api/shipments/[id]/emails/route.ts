import { NextRequest, NextResponse } from "next/server";

import {
  listShipmentEmailLogs,
  parseShipmentEmailInput,
  persistBookingEmailSend,
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
    const result = await sendShipmentEmail(input, { persistEmailLog: false });
    let persistence = null;
    let persistenceWarning: string | undefined;

    try {
      persistence = await persistBookingEmailSend(input, result.providerMessage.sentAt, {});
    } catch (error) {
      persistenceWarning =
        error instanceof Error
          ? `Email was sent, but shipment email outcome was not fully persisted: ${error.message}`
          : "Email was sent, but shipment email outcome was not fully persisted.";
    }

    return NextResponse.json({
      shipmentId,
      ...result,
      persistence,
      persistenceWarning,
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
