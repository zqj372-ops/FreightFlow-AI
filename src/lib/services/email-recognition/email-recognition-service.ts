import {
  ActionSource,
  EmailMessageSyncStatus,
  EmailRecognitionStatus,
  EmailRecognitionType as DbEmailRecognitionTypeEnum,
  ShipmentActionType,
  ShipmentDocumentStatus,
  ShipmentStatus,
  SoStatus,
  type EmailRecognitionType as DbEmailRecognitionType,
} from "@prisma/client";

import {
  classifyEmailMessage,
  matchShipmentForEmail,
  type EmailRecognitionType,
  type RawEmailMessage,
} from "@/features/freightflow/email-recognition-rules";
import { isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

export type EmailRecognitionQueueItem = {
  bodyPreview: string;
  confidence: number;
  emailMessageId: string;
  from: string;
  id: string;
  matchedShipmentId: string | null;
  messageId: string;
  receivedAt: string;
  recognitionType: EmailRecognitionType;
  riskFlags: string[];
  status: "confirmed" | "ignored" | "pending_review" | "rejected";
  subject: string;
  summary: string;
};

export type EmailRecognitionSyncResult = {
  duplicateCount: number;
  importedCount: number;
  recognitions: EmailRecognitionQueueItem[];
};

export type EmailRecognitionReviewInput = {
  reviewer?: string;
};

export type EmailRecognitionReviewResult = {
  recognitionId: string;
  shipmentId: string | null;
  status: "confirmed" | "ignored" | "rejected";
  summary: string;
};

const mockMessages: RawEmailMessage[] = [
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

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toQueueItem(
  message: RawEmailMessage,
  recognitionId: string,
  emailMessageId: string,
  shipments: ShipmentRecord[],
): EmailRecognitionQueueItem {
  const recognition = classifyEmailMessage(message);
  const matchedShipment = matchShipmentForEmail(message, shipments);

  return {
    bodyPreview: message.bodyText.slice(0, 180),
    confidence: recognition.confidence,
    emailMessageId,
    from: message.from,
    id: recognitionId,
    matchedShipmentId: matchedShipment?.id ?? null,
    messageId: message.messageId,
    receivedAt: message.receivedAt ?? new Date().toISOString(),
    recognitionType: recognition.recognitionType,
    riskFlags: recognition.riskFlags,
    status: "pending_review",
    subject: message.subject,
    summary: recognition.summary,
  };
}

export function buildMockEmailRecognitionSync(
  messages: RawEmailMessage[] = mockMessages,
  shipments: ShipmentRecord[] = mockShipments,
): EmailRecognitionSyncResult {
  const seen = new Set<string>();
  const recognitions: EmailRecognitionQueueItem[] = [];
  let duplicateCount = 0;

  for (const message of messages) {
    if (seen.has(message.messageId)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(message.messageId);
    recognitions.push(toQueueItem(message, `rec-${message.messageId}`, `email-${message.messageId}`, shipments));
  }

  return {
    duplicateCount,
    importedCount: recognitions.length,
    recognitions,
  };
}

export function listMockEmailRecognitionQueue(shipments: ShipmentRecord[] = mockShipments) {
  return buildMockEmailRecognitionSync(mockMessages, shipments).recognitions;
}

function toDbRecognitionType(type: EmailRecognitionType): DbEmailRecognitionType {
  return type as DbEmailRecognitionType;
}

function mapRecognitionRecord(record: {
  confidence: number;
  emailMessage: {
    bodyText: string;
    from: string;
    id: string;
    messageId: string;
    receivedAt: Date;
    subject: string;
  };
  emailMessageId: string;
  id: string;
  matchedShipmentId: string | null;
  recognitionType: DbEmailRecognitionType;
  riskFlags: unknown;
  status: EmailRecognitionStatus;
  summary: string;
}): EmailRecognitionQueueItem {
  return {
    bodyPreview: record.emailMessage.bodyText.slice(0, 180),
    confidence: record.confidence,
    emailMessageId: record.emailMessageId,
    from: record.emailMessage.from,
    id: record.id,
    matchedShipmentId: record.matchedShipmentId,
    messageId: record.emailMessage.messageId,
    receivedAt: record.emailMessage.receivedAt.toISOString(),
    recognitionType: record.recognitionType as EmailRecognitionType,
    riskFlags: asStringArray(record.riskFlags),
    status: record.status === EmailRecognitionStatus.CONFIRMED
      ? "confirmed"
      : record.status === EmailRecognitionStatus.IGNORED
        ? "ignored"
        : record.status === EmailRecognitionStatus.REJECTED
          ? "rejected"
          : "pending_review",
    subject: record.emailMessage.subject,
    summary: record.summary,
  };
}

export async function listEmailRecognitionQueue() {
  const records = await prisma.emailRecognitionResult.findMany({
    include: { emailMessage: true },
    orderBy: { createdAt: "desc" },
    where: { status: EmailRecognitionStatus.PENDING_REVIEW },
  });

  return records.map(mapRecognitionRecord);
}

export async function listEmailRecognitionQueueWithFallback() {
  try {
    return { data: await listEmailRecognitionQueue(), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: listMockEmailRecognitionQueue(), source: "mock" as const };
    }

    throw error;
  }
}

export async function runEmailRecognitionSync(messages: RawEmailMessage[] = mockMessages) {
  const shipments = await listShipmentsFromDatabase();
  let duplicateCount = 0;
  const recognitions: EmailRecognitionQueueItem[] = [];

  for (const message of messages) {
    const existing = await prisma.emailMessage.findUnique({ where: { messageId: message.messageId } });
    if (existing) {
      duplicateCount += 1;
      continue;
    }

    const recognition = classifyEmailMessage(message);
    const matchedShipment = matchShipmentForEmail(message, shipments);

    const emailMessage = await prisma.emailMessage.create({
      data: {
        attachments: [],
        bodySummary: recognition.summary,
        bodyText: message.bodyText,
        cc: [],
        from: message.from,
        mailbox: "INBOX",
        messageId: message.messageId,
        receivedAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
        subject: message.subject,
        syncStatus: EmailMessageSyncStatus.QUEUED,
        to: [],
      },
    });

    const result = await prisma.emailRecognitionResult.create({
      data: {
        confidence: recognition.confidence,
        emailMessageId: emailMessage.id,
        extractedFields: recognition.extractedFields,
        matchedShipmentId: matchedShipment?.id ?? null,
        recognitionType: toDbRecognitionType(recognition.recognitionType),
        riskFlags: recognition.riskFlags,
        status: EmailRecognitionStatus.PENDING_REVIEW,
        summary: recognition.summary,
      },
      include: { emailMessage: true },
    });

    recognitions.push(mapRecognitionRecord(result));
  }

  return {
    duplicateCount,
    importedCount: recognitions.length,
    recognitions,
  };
}

export async function runEmailRecognitionSyncWithFallback() {
  try {
    return { data: await runEmailRecognitionSync(), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: buildMockEmailRecognitionSync(), source: "mock" as const };
    }

    throw error;
  }
}

export async function confirmEmailRecognition(id: string, input: EmailRecognitionReviewInput = {}) {
  return prisma.$transaction(async (tx) => {
    const recognition = await tx.emailRecognitionResult.findUnique({
      include: { emailMessage: true },
      where: { id },
    });

    if (!recognition) {
      throw new Error("Recognition not found.");
    }

    if (!recognition.matchedShipmentId) {
      throw new Error("Recognition is not matched to a shipment.");
    }

    const shipment = await tx.shipment.findUnique({ where: { id: recognition.matchedShipmentId } });
    if (!shipment) {
      throw new Error("Matched shipment not found.");
    }

    const writeback = buildRecognitionWriteback(recognition.recognitionType, shipment.status);

    await tx.shipment.update({
      where: { id: recognition.matchedShipmentId },
      data: writeback.shipmentData,
    });

    await tx.emailRecognitionResult.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: normalizeReviewer(input.reviewer),
        status: EmailRecognitionStatus.CONFIRMED,
      },
    });

    await tx.emailMessage.update({
      where: { id: recognition.emailMessageId },
      data: { syncStatus: EmailMessageSyncStatus.CONFIRMED },
    });

    await tx.shipmentActionLog.create({
      data: {
        actionType: writeback.actionType,
        actorName: normalizeReviewer(input.reviewer),
        shipmentId: recognition.matchedShipmentId,
        source: ActionSource.UI,
        summary: writeback.summary,
      },
    });

    return {
      recognitionId: id,
      shipmentId: recognition.matchedShipmentId,
      status: "confirmed",
      summary: writeback.summary,
    } satisfies EmailRecognitionReviewResult;
  });
}

export async function markEmailRecognitionException(id: string, input: EmailRecognitionReviewInput = {}) {
  return prisma.$transaction(async (tx) => {
    const recognition = await tx.emailRecognitionResult.findUnique({
      include: { emailMessage: true },
      where: { id },
    });

    if (!recognition) {
      throw new Error("Recognition not found.");
    }

    if (!recognition.matchedShipmentId) {
      throw new Error("Recognition is not matched to a shipment.");
    }

    const summary = `邮件识别异常：${recognition.summary}`;

    await tx.shipment.update({
      where: { id: recognition.matchedShipmentId },
      data: { status: ShipmentStatus.EXCEPTION_PROCESSING },
    });

    await tx.shipmentException.create({
      data: {
        message: summary,
        shipmentId: recognition.matchedShipmentId,
      },
    });

    await tx.emailRecognitionResult.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: normalizeReviewer(input.reviewer),
        status: EmailRecognitionStatus.CONFIRMED,
      },
    });

    await tx.emailMessage.update({
      where: { id: recognition.emailMessageId },
      data: { syncStatus: EmailMessageSyncStatus.CONFIRMED },
    });

    await tx.shipmentActionLog.create({
      data: {
        actionType: ShipmentActionType.EXCEPTION_MARK,
        actorName: normalizeReviewer(input.reviewer),
        shipmentId: recognition.matchedShipmentId,
        source: ActionSource.UI,
        summary,
      },
    });

    return {
      recognitionId: id,
      shipmentId: recognition.matchedShipmentId,
      status: "confirmed",
      summary,
    } satisfies EmailRecognitionReviewResult;
  });
}

export async function ignoreEmailRecognition(id: string, input: EmailRecognitionReviewInput = {}) {
  return prisma.$transaction(async (tx) => {
    const recognition = await tx.emailRecognitionResult.findUnique({ where: { id } });

    if (!recognition) {
      throw new Error("Recognition not found.");
    }

    await tx.emailRecognitionResult.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: normalizeReviewer(input.reviewer),
        status: EmailRecognitionStatus.IGNORED,
      },
    });

    await tx.emailMessage.update({
      where: { id: recognition.emailMessageId },
      data: { syncStatus: EmailMessageSyncStatus.IGNORED },
    });

    return {
      recognitionId: id,
      shipmentId: recognition.matchedShipmentId,
      status: "ignored",
      summary: "邮件识别已忽略，未写回 Shipment。",
    } satisfies EmailRecognitionReviewResult;
  });
}

function normalizeReviewer(reviewer: string | undefined) {
  return reviewer?.trim() || "操作员";
}

function buildRecognitionWriteback(type: DbEmailRecognitionType, currentStatus: ShipmentStatus) {
  switch (type) {
    case DbEmailRecognitionTypeEnum.SO_RECEIVED:
      return {
        actionType: ShipmentActionType.SO_RECOGNITION,
        shipmentData: {
          soStatus: SoStatus.RECOGNIZED,
          status:
            currentStatus === ShipmentStatus.WAITING_RELEASE || currentStatus === ShipmentStatus.RELEASE_FOLLOWED_UP
              ? ShipmentStatus.RELEASED
              : currentStatus,
        },
        summary: "SO 回传已人工确认并写回 Shipment。仍保留人工审核记录。",
      };
    case DbEmailRecognitionTypeEnum.SUPPLEMENT_CONFIRMED:
      return {
        actionType: ShipmentActionType.DOCUMENTS,
        shipmentData: {
          documentStatus: ShipmentDocumentStatus.CONFIRMED,
          status:
            currentStatus === ShipmentStatus.DOCUMENTS_SENT || currentStatus === ShipmentStatus.DOCUMENTS_CONFIRMING
              ? ShipmentStatus.DOCUMENTS_CONFIRMED
              : currentStatus,
        },
        summary: "补料确认邮件已人工确认并写回 Shipment。",
      };
    case DbEmailRecognitionTypeEnum.BOOKING_REPLY:
    case DbEmailRecognitionTypeEnum.FOLLOW_UP_REPLY:
      return {
        actionType: ShipmentActionType.FOLLOW_UP,
        shipmentData: {
          lastEmailTime: new Date(),
        },
        summary: "订舱/催单回复已人工确认并记录到 Shipment。",
      };
    case DbEmailRecognitionTypeEnum.EXCEPTION:
      return {
        actionType: ShipmentActionType.EXCEPTION_MARK,
        shipmentData: {
          status: ShipmentStatus.EXCEPTION_PROCESSING,
        },
        summary: "异常邮件已人工确认并写回 Shipment。",
      };
    case DbEmailRecognitionTypeEnum.UNKNOWN:
      throw new Error("Unknown recognition cannot be confirmed. Ignore or mark it as exception instead.");
  }
}
