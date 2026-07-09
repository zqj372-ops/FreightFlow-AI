import { NextRequest, NextResponse } from "next/server";

import { buildBookingEmailContext } from "@/lib/booking/booking-email-builder";
import { validateBookingDraft } from "@/lib/booking/booking-validator";
import { readEmailConfig } from "@/lib/email-config";
import { getMockShipment, getShipmentFromDatabase, isPrismaUnavailable } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import {
  markBookingDraftFailed,
  parseShipmentEmailInput,
  persistBookingEmailSend,
  sendShipmentEmail,
} from "@/lib/services/email/email-service";

type SendBody = {
  attachmentName?: string;
  body?: string;
  cc?: string[];
  confirmed?: boolean;
  draftId?: string;
  shipment?: ShipmentRecord;
  shipmentId?: string;
  subject?: string;
  to?: string[];
};

async function loadShipment(body: SendBody) {
  if (body.shipment) return body.shipment;
  if (!body.shipmentId) throw new Error("shipmentId is required.");

  try {
    return (await getShipmentFromDatabase(body.shipmentId)) ?? getMockShipment(body.shipmentId);
  } catch (error) {
    if (isPrismaUnavailable(error)) return getMockShipment(body.shipmentId);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SendBody;

  if (body.confirmed !== true) {
    return NextResponse.json({ error: "confirmed must be true before sending booking email." }, { status: 400 });
  }

  try {
    const shipment = await loadShipment(body);
    if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });

    const draft = {
      attachmentName: body.attachmentName ?? null,
      body: body.body ?? "",
      cc: body.cc ?? [],
      subject: body.subject ?? "",
      to: body.to ?? [],
    };
    const context = buildBookingEmailContext(shipment);
    const emailConfig = await readEmailConfig();
    const validation = validateBookingDraft({
      context,
      draft: { ...draft, attachmentName: draft.attachmentName ?? "" },
      emailConfig,
      requireEmailEnabled: true,
    });

    if (!validation.canSend) {
      return NextResponse.json({ error: "Booking email is not sendable.", validation }, { status: 400 });
    }

    const input = parseShipmentEmailInput(shipment.id, draft);
    const result = await sendShipmentEmail(input, { persistEmailLog: false });
    let persistenceResult = null;
    let persistenceWarning: string | undefined;

    try {
      persistenceResult = await persistBookingEmailSend(input, result.providerMessage.sentAt, {
        draftId: body.draftId ?? null,
      });
    } catch (error) {
      persistenceWarning =
        error instanceof Error
          ? `Email was sent, but booking send outcome was not fully persisted: ${error.message}`
          : "Email was sent, but booking send outcome was not fully persisted.";
    }

    return NextResponse.json({
      data: {
        action: persistenceResult?.actionLog ?? null,
        draft: persistenceResult?.draft ?? null,
        emailLog: persistenceResult?.emailLog ?? null,
        persistence: persistenceResult,
        actionWarning: persistenceWarning ?? result.persistenceWarning,
        email: result,
        shipment: persistenceResult?.shipment ?? null,
        validation,
      },
    });
  } catch (error) {
    if (body.confirmed === true && body.shipmentId && (body.draftId || body.subject)) {
      await markBookingDraftFailed({
        draftId: body.draftId ?? null,
        shipmentId: body.shipmentId,
        subject: body.subject,
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send booking email." },
      { status: 500 },
    );
  }
}
