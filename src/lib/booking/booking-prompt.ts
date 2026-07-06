import type { BookingEmailContext } from "./booking-types";

export function buildBookingEmailPrompt(context: BookingEmailContext) {
  return [
    "You are FreightFlow-AI. Generate a concise professional booking email draft in English.",
    "Return JSON only with keys: subject, body, to, cc, missingFields, riskNotes, canSend.",
    "Do not send the email. The operator must confirm before sending.",
    "",
    "Shipment context:",
    `Batch No: ${context.shipment.batchNo}`,
    `Booking agent: ${context.bookingAgent}`,
    `Origin port: ${context.originPort}`,
    `Destination port: ${context.destinationPort}`,
    `Container: ${context.containerQuantity} x ${context.containerType}`,
    `Expected ETD: ${context.etd}`,
    `Cargo: ${context.cargoName}`,
    `Weight: ${context.weight}`,
    `Volume: ${context.volume}`,
    `Special requirements: ${context.specialRequirements}`,
  ].join("\n");
}
