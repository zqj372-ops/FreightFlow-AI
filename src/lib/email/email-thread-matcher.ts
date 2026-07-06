import type { ShipmentRecord } from "@/lib/mock-data";

import type { ParsedEmailMessage } from "./email-parser";

export type ShipmentThreadSignal = {
  messageIds?: string[];
  shipmentId: string;
  subjects?: string[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeEmailMessageId(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
}

export function normalizeThreadSubject(value: string) {
  return normalize(value)
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMessageThreadTokens(message: ParsedEmailMessage) {
  return [
    message.messageId,
    message.inReplyTo,
    message.threadId,
    ...(message.references ?? []),
  ]
    .map(normalizeEmailMessageId)
    .filter(Boolean);
}

function scoreThreadSignals(message: ParsedEmailMessage, signal: ShipmentThreadSignal | undefined) {
  if (!signal) return 0;

  let score = 0;
  const messageTokens = new Set(getMessageThreadTokens(message));
  const signalMessageIds = (signal.messageIds ?? []).map(normalizeEmailMessageId).filter(Boolean);

  if (signalMessageIds.some((messageId) => messageTokens.has(messageId))) {
    score += 8;
  }

  const messageSubject = normalizeThreadSubject(message.subject);
  const signalSubjects = (signal.subjects ?? []).map(normalizeThreadSubject).filter(Boolean);

  if (signalSubjects.some((subject) => subject === messageSubject)) {
    score += 5;
  } else if (signalSubjects.some((subject) => subject && messageSubject.includes(subject))) {
    score += 3;
  }

  return score;
}

function scoreMessageForShipment(
  message: ParsedEmailMessage,
  shipment: ShipmentRecord,
  signal: ShipmentThreadSignal | undefined,
) {
  const haystack = normalize([
    message.subject,
    message.body,
    message.from,
    message.threadId,
    message.inReplyTo,
    ...(message.references ?? []),
  ].join(" "));
  let score = 0;

  if (haystack.includes(normalize(shipment.id))) score += 6;
  if (haystack.includes(normalize(shipment.batchNo))) score += 5;
  if (shipment.soNo && haystack.includes(normalize(shipment.soNo))) score += 4;
  if (shipment.containerNo && haystack.includes(normalize(shipment.containerNo))) score += 4;
  if (haystack.includes(normalize(shipment.bookingAgent))) score += 2;
  if (haystack.includes("booking") || haystack.includes("confirmation") || haystack.includes("so")) score += 1;

  return score + scoreThreadSignals(message, signal);
}

export function matchEmailToShipment(
  message: ParsedEmailMessage,
  shipments: ShipmentRecord[],
  threadSignals: ShipmentThreadSignal[] = [],
) {
  const signalsByShipmentId = new Map(threadSignals.map((signal) => [signal.shipmentId, signal]));
  const ranked = shipments
    .map((shipment) => ({
      shipment,
      score: scoreMessageForShipment(message, shipment, signalsByShipmentId.get(shipment.id)),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  return best && best.score >= 4 ? best : null;
}
