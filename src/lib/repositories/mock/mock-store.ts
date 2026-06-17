/**
 * In-memory store used by the mock adapters. Module-level so all mock
 * repositories share the same data set across a single Node process.
 *
 * The store is seeded lazily on first access (see `seedMockStore`) so
 * tests that mutate the store can call `resetMockStore` to return to
 * the baseline fixture derived from `@/lib/mock-data`.
 */
import {
  buildBookingDraftBatchResult,
  buildBookingPlanRecord,
} from "@/features/freightflow/booking-plan-rules";
import type { RawEmailMessage } from "@/features/freightflow/email-recognition-rules";
import { mockShipments } from "@/lib/freightflow-data";
import { shipments as baseShipments, type ShipmentRecord } from "@/lib/mock-data";

import type { BookingPlanRecord } from "../booking-plan-repository";
import type { EmailDraftRecord, EmailDraftStatus } from "../email-draft-repository";
import type { EmailMessageRecord } from "../email-message-repository";
import type { EmailRecognitionRecord } from "../email-recognition-repository";

export type MockStore = {
  bookings: BookingPlanRecord[];
  drafts: EmailDraftRecord[];
  emailMessages: EmailMessageRecord[];
  recognitions: EmailRecognitionRecord[];
  shipments: ShipmentRecord[];
};

const mockSeedMessages: RawEmailMessage[] = [
  {
    bodyText: "您好，SO已出，附件请查收。SO: OOLU8791320。",
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

let store: MockStore | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function seedStore(): MockStore {
  const shipments = clone(baseShipments);

  const draftBatchPreview = buildBookingDraftBatchResult(
    shipments.slice(0, 3).map((shipment) => shipment.id),
    shipments,
  );

  const drafts: EmailDraftRecord[] = [];
  let counter = 1;

  for (const item of draftBatchPreview.items) {
    if (item.status !== "success" || !item.draft) continue;
    const now = nowIso();
    drafts.push({
      attachmentName: item.draft.attachmentName,
      body: item.draft.body,
      cc: [...item.draft.cc],
      createdAt: now,
      createdFromPlanId: null,
      id: `mock-draft-${counter}`,
      lastError: null,
      sentEmailLogId: null,
      shipmentId: item.plan.shipmentId,
      status: "pending_review" as EmailDraftStatus,
      subject: item.draft.subject,
      to: [...item.draft.to],
      updatedAt: now,
    });
    counter += 1;
  }

  const bookings: BookingPlanRecord[] = draftBatchPreview.items
    .map<BookingPlanRecord | null>((item) => {
      if (item.status !== "success") return null;
      const planRecord = buildBookingPlanRecord(
        shipments.find((shipment) => shipment.id === item.plan.shipmentId) ?? shipments[0],
      );
      const draftId = drafts.find((draft) => draft.shipmentId === item.plan.shipmentId)?.id ?? null;
      return {
        ...planRecord,
        id: item.plan.id,
        lastDraftId: draftId,
        planStatus: "draft_ready",
        preferredBookingAgent: planRecord.bookingAgent || null,
      };
    })
    .filter((plan): plan is BookingPlanRecord => plan !== null);

  const emailMessages: EmailMessageRecord[] = mockSeedMessages.map((message) => {
    const now = nowIso();
    return {
      attachments: [],
      bodySummary: "",
      bodyText: message.bodyText,
      cc: [],
      createdAt: message.receivedAt ?? now,
      from: message.from,
      id: `mock-email-${message.messageId}`,
      mailbox: "INBOX",
      messageId: message.messageId,
      receivedAt: message.receivedAt ?? now,
      subject: message.subject,
      syncStatus: "new",
      threadId: null,
      to: [],
      updatedAt: message.receivedAt ?? now,
    };
  });

  const recognitions: EmailRecognitionRecord[] = emailMessages.map((message) => {
    const now = nowIso();
    const lowerBody = message.bodyText.toLowerCase();
    const recognitionType: EmailRecognitionRecord["recognitionType"] = lowerBody.includes("柜型不符")
      ? "EXCEPTION"
      : lowerBody.includes("si confirmed") || lowerBody.includes("documents are confirmed")
        ? "SUPPLEMENT_CONFIRMED"
        : "SO_RECEIVED";
    return {
      confidence: 0.85,
      createdAt: now,
      emailMessageId: message.id,
      extractedFields: {},
      id: `mock-rec-${message.messageId}`,
      matchedShipmentId: mockShipments.find((shipment) => message.subject.includes(shipment.batchNo))?.id ?? null,
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
  });

  return {
    bookings,
    drafts,
    emailMessages,
    recognitions,
    shipments,
  };
}

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
 * Test-only escape hatch. Returns whether the store is currently using
 * a user-defined value (after a `setMockStore` call) so tests can assert
 * the factory wired them up correctly.
 */
export function setMockStore(next: MockStore | null): void {
  store = next;
}
