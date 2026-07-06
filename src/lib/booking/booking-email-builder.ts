import { formatFreightFlowEmail } from "@/lib/freightflow-domain";
import type { ShipmentRecord } from "@/lib/mock-data";

import type { BookingEmailContext, BookingEmailDraft } from "./booking-types";

export type BookingEmailOverrides = {
  cargoName?: string;
  containerQuantity?: number;
  customerName?: string;
  specialRequirements?: string;
  volume?: string;
  weight?: string;
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

export function buildBookingEmailContext(
  shipment: ShipmentRecord,
  overrides: BookingEmailOverrides = {},
): BookingEmailContext {
  return {
    attachmentName: `${shipment.batchNo}-shipping-instruction.pdf`,
    bookingAgent: shipment.bookingAgent,
    cargoName: clean(overrides.cargoName, "General cargo"),
    containerQuantity: Math.max(1, Math.round(overrides.containerQuantity ?? 1)),
    containerType: shipment.containerType,
    customerName: clean(overrides.customerName, "FreightFlow customer"),
    destinationPort: shipment.destinationPort,
    etd: shipment.etd,
    originPort: shipment.originPort,
    shipment,
    specialRequirements: clean(overrides.specialRequirements, "Please confirm space and release SO once available."),
    volume: clean(overrides.volume, "TBC"),
    weight: clean(overrides.weight, "TBC"),
  };
}

export function buildDeterministicBookingDraft(context: BookingEmailContext): BookingEmailDraft {
  const shipment = context.shipment;

  return {
    to: [formatFreightFlowEmail(context.bookingAgent)],
    cc: ["ops@freightflow.ai"],
    subject: `${shipment.batchNo} Booking Request | ${context.containerQuantity} x ${context.containerType} | ${context.originPort} - ${context.destinationPort}`,
    attachmentName: context.attachmentName,
    body: [
      `Dear ${context.bookingAgent},`,
      "",
      "Please help arrange booking for the below shipment.",
      "",
      `Customer: ${context.customerName}`,
      `Batch No: ${shipment.batchNo}`,
      `Container: ${context.containerQuantity} x ${context.containerType}`,
      `POL: ${context.originPort}`,
      `POD: ${context.destinationPort}`,
      `Carrier preference: ${shipment.carrier}`,
      `Expected ETD: ${context.etd}`,
      `Cargo: ${context.cargoName}`,
      `Weight: ${context.weight}`,
      `Volume: ${context.volume}`,
      "",
      `Special requirements: ${context.specialRequirements}`,
      "",
      "Shipping instruction is attached for your reference.",
      "Please confirm space and release SO once available.",
      "",
      "Best regards,",
      "FreightFlow AI Ops",
    ].join("\n"),
  };
}
