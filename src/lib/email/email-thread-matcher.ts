import type { ShipmentRecord } from "@/lib/mock-data";

import type { ParsedEmailMessage } from "./email-parser";

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreMessageForShipment(message: ParsedEmailMessage, shipment: ShipmentRecord) {
  const haystack = normalize([message.subject, message.body, message.from].join(" "));
  let score = 0;

  if (haystack.includes(normalize(shipment.id))) score += 6;
  if (haystack.includes(normalize(shipment.batchNo))) score += 5;
  if (shipment.soNo && haystack.includes(normalize(shipment.soNo))) score += 4;
  if (shipment.containerNo && haystack.includes(normalize(shipment.containerNo))) score += 4;
  if (haystack.includes(normalize(shipment.bookingAgent))) score += 2;
  if (haystack.includes("booking") || haystack.includes("confirmation") || haystack.includes("so")) score += 1;

  return score;
}

export function matchEmailToShipment(message: ParsedEmailMessage, shipments: ShipmentRecord[]) {
  const ranked = shipments
    .map((shipment) => ({ shipment, score: scoreMessageForShipment(message, shipment) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  return best && best.score >= 4 ? best : null;
}
