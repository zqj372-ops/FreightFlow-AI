/**
 * In-memory store used by the mock adapters. Module-level so all mock
 * repositories share the same data set across a single Node process.
 *
 * The store is seeded lazily on first access (see `seedMockStore`) so
 * tests that mutate the store can call `resetMockStore` to return to
 * the baseline fixture derived from `@/lib/mock-data`.
 */
import { shipments as baseShipments, type ShipmentRecord } from "@/lib/mock-data";

import type { BookingPlanRecord } from "../booking-plan-repository";
import type { EmailDraftRecord } from "../email-draft-repository";
import type { EmailMessageRecord } from "../email-message-repository";
import type { EmailRecognitionRecord } from "../email-recognition-repository";
import type { BookingPlanStatus } from "../types";

export type MockStore = {
  bookings: BookingPlanRecord[];
  drafts: EmailDraftRecord[];
  emailMessages: EmailMessageRecord[];
  recognitions: EmailRecognitionRecord[];
  shipments: ShipmentRecord[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function buildBookingPlanFixture(
  shipment: ShipmentRecord,
  index: number,
): BookingPlanRecord {
  const now = nowIso();
  const missingFields =
    shipment.documentStatus === "待生成" && shipment.soStatus === "待识别"
      ? ["soNo", "vesselVoyage"]
      : [];
  const riskFlags = shipment.exceptions.length > 0 ? [...shipment.exceptions] : [];
  const planStatus: BookingPlanStatus = missingFields.length > 0 ? "missing_info" : "ready_to_draft";

  return {
    batchNo: shipment.batchNo,
    bookingAgent: shipment.bookingAgent,
    containerType: shipment.containerType,
    destinationPort: shipment.destinationPort,
    id: `mock-plan-${index + 1}`,
    lastDraftId: null,
    lastError: null,
    missingFields,
    originPort: shipment.originPort,
    planStatus,
    preferredBookingAgent: shipment.bookingAgent || null,
    riskFlags,
    shipmentId: shipment.id,
  };
}

function buildEmailDraftFixture(plan: BookingPlanRecord, index: number): EmailDraftRecord {
  const now = nowIso();
  return {
    attachmentName: null,
    body: `Mock 订舱邮件草稿 (${plan.shipmentId})`,
    cc: [],
    createdAt: now,
    createdFromPlanId: plan.id,
    draftType: "booking",
    id: `mock-draft-${index + 1}`,
    lastError: null,
    sentEmailLogId: null,
    shipmentId: plan.shipmentId,
    status: "pending_review",
    subject: `[订舱] ${plan.batchNo} - 托书确认`,
    to: [`${plan.bookingAgent.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`],
    updatedAt: now,
  };
}

const seedEmails: Array<{
  bodyText: string;
  from: string;
  messageId: string;
  receivedAt: string;
  subject: string;
}> = [
  {
    bodyText: "SO已出，附件请查收。SO: OOLU8791320。",
    from: "seabay.logistics@freightflow.ai",
    messageId: "mock-so-released-001",
    receivedAt: "2026-06-13T08:00:00.000Z",
    subject: "FF-CA-240610-A01 SO已出",
  },
  {
    bodyText: "Dear team, SI Confirmed for COSU5519028. Documents are confirmed.",
    from: "apex.forwarding@freightflow.ai",
    messageId: "mock-si-confirmed-002",
    receivedAt: "2026-06-13T08:15:00.000Z",
    subject: "FF-US-240610-B03 SI Confirmed",
  },
  {
    bodyText: "代理反馈柜型不符，请确认是否由 40HQ 改为 40GP。",
    from: "blue.anchor@freightflow.ai",
    messageId: "mock-exception-003",
    receivedAt: "2026-06-13T08:30:00.000Z",
    subject: "FF-CA-240610-E15 柜型不符，请修改资料",
  },
];

function buildEmailMessageFixture(seed: typeof seedEmails[number]): EmailMessageRecord {
  const now = nowIso();
  return {
    attachments: [],
    bodySummary: "",
    bodyText: seed.bodyText,
    cc: [],
    createdAt: seed.receivedAt,
    from: seed.from,
    id: `mock-email-${seed.messageId}`,
    mailbox: "INBOX",
    messageId: seed.messageId,
    receivedAt: seed.receivedAt,
    subject: seed.subject,
    syncStatus: "new",
    threadId: null,
    to: [],
    updatedAt: seed.receivedAt,
  };
}

function buildRecognitionFixture(
  email: EmailMessageRecord,
  shipments: ShipmentRecord[],
): EmailRecognitionRecord {
  const now = nowIso();
  const lower = email.bodyText.toLowerCase();
  const matched =
    shipments.find((s) => email.subject.includes(s.batchNo)) ?? null;
  const recognitionType: EmailRecognitionRecord["recognitionType"] =
    lower.includes("柜型不符")
      ? "EXCEPTION"
      : lower.includes("si confirmed") || lower.includes("documents are confirmed")
        ? "SUPPLEMENT_CONFIRMED"
        : "SO_RECEIVED";

  return {
    confidence: 0.85,
    createdAt: now,
    emailMessageId: email.id,
    extractedFields: {},
    id: `mock-rec-${email.messageId}`,
    matchedShipmentId: matched?.id ?? null,
    recognitionType,
    reviewedAt: null,
    reviewedBy: null,
    riskFlags: recognitionType === "EXCEPTION" ? ["柜型不符"] : [],
    status: "pending_review",
    summary:
      recognitionType === "EXCEPTION"
        ? "识别到异常邮件：代理反馈柜型或资料不一致，需要人工确认后处理。"
        : recognitionType === "SUPPLEMENT_CONFIRMED"
          ? "识别到补料确认邮件，建议人工确认后更新补料状态。"
          : "识别到代理放舱回传邮件，建议核对 SO 号码、附件和截补料时间后写回 Shipment。",
    updatedAt: now,
  };
}

function seedStore(): MockStore {
  const shipments = clone(baseShipments);

  const bookings: BookingPlanRecord[] = shipments.map(buildBookingPlanFixture);
  const drafts: EmailDraftRecord[] = bookings.map(buildEmailDraftFixture);

  // Bind draft back-reference on plan for parity with service layer.
  for (let i = 0; i < bookings.length; i += 1) {
    const plan = bookings[i];
    const draft = drafts[i];
    if (plan && draft) {
      plan.lastDraftId = draft.id;
    }
  }

  const emailMessages: EmailMessageRecord[] = seedEmails.map(buildEmailMessageFixture);
  const recognitions: EmailRecognitionRecord[] = emailMessages.map((email) =>
    buildRecognitionFixture(email, shipments),
  );

  return {
    bookings,
    drafts,
    emailMessages,
    recognitions,
    shipments,
  };
}

let store: MockStore | null = null;

export function getMockStore(): MockStore {
  if (!store) {
    store = seedStore();
  }
  return store;
}

export function resetMockStore(): MockStore {
  store = seedStore();
  return store;
}

/**
 * Test-only escape hatch. Replaces the active store with the supplied
 * value (or `null` to clear the cache) so unit tests can wire custom
 * fixtures.
 */
export function setMockStore(next: MockStore | null): void {
  store = next;
}
