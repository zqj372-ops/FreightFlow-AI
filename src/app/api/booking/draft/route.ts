import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { buildBookingEmailContext, buildDeterministicBookingDraft, type BookingEmailOverrides } from "@/lib/booking/booking-email-builder";
import { buildBookingEmailPrompt } from "@/lib/booking/booking-prompt";
import { validateBookingDraft } from "@/lib/booking/booking-validator";
import { getMockShipment, getShipmentFromDatabase, isPrismaUnavailable } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { readEmailConfig } from "@/lib/email-config";
import { prisma } from "@/lib/prisma";

type DraftBody = BookingEmailOverrides & {
  shipment?: ShipmentRecord;
  shipmentId?: string;
};

async function loadShipment(body: DraftBody) {
  if (body.shipment) return body.shipment;
  if (!body.shipmentId) throw new Error("shipmentId is required.");

  try {
    return (await getShipmentFromDatabase(body.shipmentId)) ?? getMockShipment(body.shipmentId);
  } catch (error) {
    if (isPrismaUnavailable(error)) return getMockShipment(body.shipmentId);
    throw error;
  }
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as DraftBody;

  try {
    const shipment = await loadShipment(body);
    if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });

    const context = buildBookingEmailContext(shipment, body);
    const draft = buildDeterministicBookingDraft(context);
    const emailConfig = await readEmailConfig();
    const validation = validateBookingDraft({ context, draft, emailConfig });
    const prompt = buildBookingEmailPrompt(context);
    let draftId: string | null = null;
    let warning: string | undefined;

    try {
      const record = await prisma.bookingEmailDraft.create({
        data: {
          shipmentId: shipment.id,
          subject: draft.subject,
          body: draft.body,
          to: jsonValue(draft.to),
          cc: jsonValue(draft.cc),
          status: "DRAFT",
        },
        select: { id: true },
      });
      draftId = record.id;
    } catch (error) {
      if (!isPrismaUnavailable(error)) console.warn("Booking email draft persistence skipped", error);
      warning = "Draft was generated but not persisted because the database is unavailable or migrations are pending.";
    }

    return NextResponse.json({
      data: {
        ...validation,
        draft,
        draftId,
        persisted: Boolean(draftId),
        prompt,
        source: "local",
        warning,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate booking draft." },
      { status: 400 },
    );
  }
}
