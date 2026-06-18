import {
  ActionSource,
  EmailMessageSyncStatus,
  EmailRecognitionStatus,
  EmailRecognitionType as DbEmailRecognitionTypeEnum,
  MailStatus,
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
import { formatDateForUi, isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getRepositories, type RecognitionWithEmail } from "@/lib/repositories";

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

type RecognitionWriteback = {
  actionType: ShipmentActionType;
  clearExceptionKeywords?: string[];
  clearReminderKeywords?: string[];
  exceptionMessage?: string;
  shipmentData: Record<string, unknown>;
  summary: string;
};

type MockRecognitionWriteback = {
  actionType: "订舱邮件" | "催单提醒" | "补料文件" | "SO 识别" | "AMS/ACI/ISF" | "异常标记";
  shipmentPatch: Partial<ShipmentRecord>;
  summary: string;
};

type RecognitionExtractedFields = {
  carrier?: string;
  containerNo?: string;
  containerType?: string;
  etd?: string;
  soNo?: string;
  vesselVoyage?: string;
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

function stringField(fields: unknown, key: keyof RecognitionExtractedFields) {
  if (!fields || typeof fields !== "object") return undefined;

  const value = (fields as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseRecognitionFields(fields: unknown): RecognitionExtractedFields {
  return {
    carrier: stringField(fields, "carrier"),
    containerNo: stringField(fields, "containerNo"),
    containerType: stringField(fields, "containerType"),
    etd: stringField(fields, "etd"),
    soNo: stringField(fields, "soNo"),
    vesselVoyage: stringField(fields, "vesselVoyage"),
  };
}

function removeItemsContaining(items: string[], keywords: string[]) {
  return items.filter((item) => !keywords.some((keyword) => item.includes(keyword)));
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

function mapRepositoryRecognition(record: RecognitionWithEmail): EmailRecognitionQueueItem {
  return {
    bodyPreview: record.emailMessage.bodyText.slice(0, 180),
    confidence: record.confidence,
    emailMessageId: record.emailMessageId,
    from: record.emailMessage.from,
    id: record.id,
    matchedShipmentId: record.matchedShipmentId,
    messageId: record.emailMessage.messageId,
    receivedAt: record.emailMessage.receivedAt,
    recognitionType: record.recognitionType,
    riskFlags: [...record.riskFlags],
    status: record.status,
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
  if (!isDatabaseConfigured()) {
    return { data: await listMockEmailRecognitionQueueFromStore(), source: "mock" as const };
  }

  try {
    return { data: await listEmailRecognitionQueue(), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: await listMockEmailRecognitionQueueFromStore(), source: "mock" as const };
    }

    throw error;
  }
}

async function listMockEmailRecognitionQueueFromStore() {
  const repositories = await getRepositories();
  const records = await repositories.emailRecognitions.listPending();
  return records.map(mapRepositoryRecognition);
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

export async function createRecognitionFromEmailMessage(emailMessageId: string) {
  const [message, shipments] = await Promise.all([
    prisma.emailMessage.findUnique({ where: { id: emailMessageId } }),
    listShipmentsFromDatabase(),
  ]);

  if (!message) {
    throw new Error(`Email message ${emailMessageId} not found.`);
  }

  const rawMessage: RawEmailMessage = {
    bodyText: message.bodyText,
    from: message.from,
    messageId: message.messageId,
    receivedAt: message.receivedAt.toISOString(),
    subject: message.subject,
  };
  const recognition = classifyEmailMessage(rawMessage);
  const matchedShipment = matchShipmentForEmail(rawMessage, shipments);

  await prisma.emailMessage.update({
    data: { syncStatus: EmailMessageSyncStatus.QUEUED },
    where: { id: emailMessageId },
  });

  const result = await prisma.emailRecognitionResult.create({
    data: {
      confidence: recognition.confidence,
      emailMessageId: message.id,
      extractedFields: recognition.extractedFields,
      matchedShipmentId: matchedShipment?.id ?? null,
      recognitionType: toDbRecognitionType(recognition.recognitionType),
      riskFlags: recognition.riskFlags,
      status: EmailRecognitionStatus.PENDING_REVIEW,
      summary: recognition.summary,
    },
    include: { emailMessage: true },
  });

  return mapRecognitionRecord(result);
}

export async function runEmailRecognitionSyncWithFallback() {
  if (!isDatabaseConfigured()) {
    return { data: await runMockEmailRecognitionSync(), source: "mock" as const };
  }

  try {
    return { data: await runEmailRecognitionSync(), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: await runMockEmailRecognitionSync(), source: "mock" as const };
    }

    throw error;
  }
}

async function runMockEmailRecognitionSync(messages: RawEmailMessage[] = mockMessages) {
  const repositories = await getRepositories();
  const shipments = await repositories.shipments.list();
  let duplicateCount = 0;
  const recognitions: EmailRecognitionQueueItem[] = [];

  for (const message of messages) {
    const existing = await repositories.emailMessages.getByMessageId(message.messageId);
    if (existing) {
      duplicateCount += 1;
      continue;
    }

    const recognition = classifyEmailMessage(message);
    const matchedShipment = matchShipmentForEmail(message, shipments);
    const receivedAt = message.receivedAt ?? new Date().toISOString();
    const emailMessage = await repositories.emailMessages.create({
      attachments: [],
      bodySummary: recognition.summary,
      bodyText: message.bodyText,
      cc: [],
      from: message.from,
      mailbox: "INBOX",
      messageId: message.messageId,
      receivedAt,
      subject: message.subject,
      syncStatus: "queued",
      threadId: null,
      to: [],
    });
    const record = await repositories.emailRecognitions.create({
      confidence: recognition.confidence,
      emailMessageId: emailMessage.id,
      extractedFields: recognition.extractedFields,
      matchedShipmentId: matchedShipment?.id ?? null,
      recognitionType: recognition.recognitionType,
      riskFlags: recognition.riskFlags,
      status: "pending_review",
      summary: recognition.summary,
    });
    const withEmail = await repositories.emailRecognitions.getById(record.id);
    if (withEmail) {
      recognitions.push(mapRepositoryRecognition(withEmail));
    }
  }

  return {
    duplicateCount,
    importedCount: recognitions.length,
    recognitions,
  } satisfies EmailRecognitionSyncResult;
}

export async function confirmEmailRecognition(id: string, input: EmailRecognitionReviewInput = {}) {
  if (!isDatabaseConfigured()) {
    return confirmMockEmailRecognition(id, input);
  }

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

    const writeback = buildRecognitionWriteback(
      recognition.recognitionType,
      shipment.status,
      parseRecognitionFields(recognition.extractedFields),
      recognition.summary,
    );

    await tx.shipment.update({
      where: { id: recognition.matchedShipmentId },
      data: writeback.shipmentData,
    });

    if (writeback.clearExceptionKeywords?.length) {
      await tx.shipmentException.deleteMany({
        where: {
          shipmentId: recognition.matchedShipmentId,
          OR: writeback.clearExceptionKeywords.map((keyword) => ({ message: { contains: keyword } })),
        },
      });
    }

    if (writeback.clearReminderKeywords?.length) {
      await tx.shipmentReminderFlag.deleteMany({
        where: {
          shipmentId: recognition.matchedShipmentId,
          OR: writeback.clearReminderKeywords.map((keyword) => ({ message: { contains: keyword } })),
        },
      });
    }

    if (writeback.exceptionMessage) {
      await tx.shipmentException.create({
        data: {
          message: writeback.exceptionMessage,
          shipmentId: recognition.matchedShipmentId,
        },
      });
    }

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
  if (!isDatabaseConfigured()) {
    return markMockEmailRecognitionException(id, input);
  }

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
    const writeback = buildExceptionWriteback(summary);

    await tx.shipment.update({
      where: { id: recognition.matchedShipmentId },
      data: writeback.shipmentData,
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
  if (!isDatabaseConfigured()) {
    return ignoreMockEmailRecognition(id, input);
  }

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

async function confirmMockEmailRecognition(id: string, input: EmailRecognitionReviewInput) {
  const repositories = await getRepositories();
  const recognition = await repositories.emailRecognitions.getById(id);

  if (!recognition) {
    throw new Error("Recognition not found.");
  }

  if (!recognition.matchedShipmentId) {
    throw new Error("Recognition is not matched to a shipment.");
  }

  const shipment = await repositories.shipments.getById(recognition.matchedShipmentId);
  if (!shipment) {
    throw new Error("Matched shipment not found.");
  }

  const writeback = buildMockRecognitionWriteback(recognition, shipment);
  const now = new Date().toISOString();

  await repositories.shipments.advanceStatus({
    patch: writeback.shipmentPatch,
    shipmentId: recognition.matchedShipmentId,
  });
  await repositories.emailRecognitions.updateStatus({
    id,
    reviewedAt: now,
    reviewedBy: normalizeReviewer(input.reviewer),
    status: "confirmed",
  });
  await repositories.emailMessages.updateSyncStatus({
    id: recognition.emailMessageId,
    syncStatus: "confirmed",
  });
  await repositories.shipments.recordActionLog({
    actionType: writeback.actionType,
    actorName: normalizeReviewer(input.reviewer),
    shipmentId: recognition.matchedShipmentId,
    source: "UI",
    summary: writeback.summary,
  });

  return {
    recognitionId: id,
    shipmentId: recognition.matchedShipmentId,
    status: "confirmed",
    summary: writeback.summary,
  } satisfies EmailRecognitionReviewResult;
}

async function markMockEmailRecognitionException(id: string, input: EmailRecognitionReviewInput) {
  const repositories = await getRepositories();
  const recognition = await repositories.emailRecognitions.getById(id);

  if (!recognition) {
    throw new Error("Recognition not found.");
  }

  if (!recognition.matchedShipmentId) {
    throw new Error("Recognition is not matched to a shipment.");
  }

  const shipment = await repositories.shipments.getById(recognition.matchedShipmentId);
  const summary = `邮件识别异常：${recognition.summary}`;
  const writeback = buildMockExceptionWriteback(summary, shipment ?? undefined);
  const now = new Date().toISOString();

  await repositories.shipments.advanceStatus({
    patch: writeback.shipmentPatch,
    shipmentId: recognition.matchedShipmentId,
  });
  await repositories.emailRecognitions.updateStatus({
    id,
    reviewedAt: now,
    reviewedBy: normalizeReviewer(input.reviewer),
    status: "confirmed",
  });
  await repositories.emailMessages.updateSyncStatus({
    id: recognition.emailMessageId,
    syncStatus: "confirmed",
  });
  await repositories.shipments.recordActionLog({
    actionType: "异常标记",
    actorName: normalizeReviewer(input.reviewer),
    shipmentId: recognition.matchedShipmentId,
    source: "UI",
    summary,
  });

  return {
    recognitionId: id,
    shipmentId: recognition.matchedShipmentId,
    status: "confirmed",
    summary,
  } satisfies EmailRecognitionReviewResult;
}

async function ignoreMockEmailRecognition(id: string, input: EmailRecognitionReviewInput) {
  const repositories = await getRepositories();
  const recognition = await repositories.emailRecognitions.getById(id);

  if (!recognition) {
    throw new Error("Recognition not found.");
  }

  const now = new Date().toISOString();
  await repositories.emailRecognitions.updateStatus({
    id,
    reviewedAt: now,
    reviewedBy: normalizeReviewer(input.reviewer),
    status: "ignored",
  });
  await repositories.emailMessages.updateSyncStatus({
    id: recognition.emailMessageId,
    syncStatus: "ignored",
  });

  return {
    recognitionId: id,
    shipmentId: recognition.matchedShipmentId,
    status: "ignored",
    summary: "邮件识别已忽略，未写回 Shipment。",
  } satisfies EmailRecognitionReviewResult;
}

function normalizeReviewer(reviewer: string | undefined) {
  return reviewer?.trim() || "操作员";
}

function buildMockExceptionWriteback(summary: string, shipment?: ShipmentRecord): MockRecognitionWriteback {
  return {
    actionType: "异常标记",
    shipmentPatch: {
      aiSummary: `${summary} 当前需要人工判定是否改柜型、重发资料或联系客户确认。`,
      exceptions: Array.from(new Set([...(shipment?.exceptions ?? []), summary])),
      nextAction: "先核对原始邮件与 SO/托书字段，再联系客户或代理确认处理口径。",
      status: "异常处理中",
    },
    summary,
  };
}

function buildMockRecognitionWriteback(
  recognition: RecognitionWithEmail,
  shipment: ShipmentRecord,
): MockRecognitionWriteback {
  const fields = parseRecognitionFields(recognition.extractedFields);

  switch (recognition.recognitionType) {
    case "SO_RECEIVED": {
      const soLabel = fields.soNo ? `SO ${fields.soNo}` : "SO";

      return {
        actionType: "SO 识别" as const,
        shipmentPatch: {
          ...(fields.carrier ? { carrier: fields.carrier } : {}),
          ...(fields.containerNo ? { containerNo: fields.containerNo } : {}),
          ...(fields.containerType ? { containerType: fields.containerType } : {}),
          ...(fields.soNo ? { soNo: fields.soNo } : {}),
          ...(fields.vesselVoyage ? { vesselVoyage: fields.vesselVoyage } : {}),
          aiSummary: `${soLabel} 已回传并经人工确认，放舱节点已闭环；下一步进入补料、截单和申报准备。`,
          exceptions: removeItemsContaining(shipment.exceptions, ["等待放舱", "放舱超过", "SO 尚未", "尚未返回 SO"]),
          hoursWaitingRelease: 0,
          mailStatus: "已发送" as const,
          nextAction: "核对 SO 附件中的柜号、柜型、船名航次和截单/截关时间，然后推进补料与 AMS/ACI/ISF。",
          reminderFlags: removeItemsContaining(shipment.reminderFlags, ["催单", "放舱", "SO"]),
          soStatus: "已识别" as const,
          status:
            shipment.status === "已发送订舱" || shipment.status === "等待放舱" || shipment.status === "已催放舱"
              ? "已放舱" as const
              : shipment.status,
        },
        summary: "SO 回传已人工确认并写回 Shipment。仍保留人工审核记录。",
      };
    }
    case "SUPPLEMENT_CONFIRMED":
      return {
        actionType: "补料文件" as const,
        shipmentPatch: {
          aiSummary: "补料确认邮件已人工确认，SI/补料节点已闭环；下一步推进申报、截关校验和装船前跟踪。",
          documentStatus: "已确认" as const,
          exceptions: removeItemsContaining(shipment.exceptions, ["补料", "SI"]),
          nextAction: "复核 AMS/ACI/ISF 与报关资料状态，确认截关前所有申报文件已完成。",
          reminderFlags: removeItemsContaining(shipment.reminderFlags, ["补料", "SI"]),
          status:
            shipment.status === "已放舱" ||
            shipment.status === "待补料" ||
            shipment.status === "已发送补料" ||
            shipment.status === "等待补料确认"
              ? "补料已确认" as const
              : shipment.status,
        },
        summary: "补料确认邮件已人工确认并写回 Shipment。",
      };
    case "BOOKING_REPLY":
    case "FOLLOW_UP_REPLY":
      return {
        actionType: "催单提醒" as const,
        shipmentPatch: {
          lastEmailTime: formatDateForUi(new Date()),
        },
        summary: "订舱/催单回复已人工确认并记录到 Shipment。",
      };
    case "EXCEPTION":
      return {
        ...buildMockExceptionWriteback(`邮件识别异常：${recognition.summary}`, shipment),
        summary: "异常邮件已人工确认并写回 Shipment。",
      };
    case "UNKNOWN":
      throw new Error("Unknown recognition cannot be confirmed. Ignore or mark it as exception instead.");
  }
}

function buildExceptionWriteback(summary: string): Pick<RecognitionWriteback, "shipmentData" | "summary"> {
  return {
    shipmentData: {
      aiSummary: `${summary} 当前需要人工判定是否改柜型、重发资料或联系客户确认。`,
      nextAction: "先核对原始邮件与 SO/托书字段，再联系客户或代理确认处理口径。",
      status: ShipmentStatus.EXCEPTION_PROCESSING,
    },
    summary,
  };
}

function buildRecognitionWriteback(
  type: DbEmailRecognitionType,
  currentStatus: ShipmentStatus,
  fields: RecognitionExtractedFields = {},
  recognitionSummary = "识别到异常邮件：代理反馈柜型或资料不一致，需要人工确认后处理。",
): RecognitionWriteback {
  switch (type) {
    case DbEmailRecognitionTypeEnum.SO_RECEIVED: {
      const soLabel = fields.soNo ? `SO ${fields.soNo}` : "SO";
      return {
        actionType: ShipmentActionType.SO_RECOGNITION,
        clearExceptionKeywords: ["等待放舱", "放舱超过", "SO 尚未", "尚未返回 SO"],
        clearReminderKeywords: ["催单", "放舱", "SO"],
        shipmentData: {
          ...(fields.carrier ? { carrier: fields.carrier } : {}),
          ...(fields.containerNo ? { containerNo: fields.containerNo } : {}),
          ...(fields.containerType ? { containerType: fields.containerType } : {}),
          ...(fields.soNo ? { soNo: fields.soNo } : {}),
          ...(fields.vesselVoyage ? { vesselVoyage: fields.vesselVoyage } : {}),
          aiSummary: `${soLabel} 已回传并经人工确认，放舱节点已闭环；下一步进入补料、截单和申报准备。`,
          hoursWaitingRelease: 0,
          mailStatus: MailStatus.SENT,
          nextAction: "核对 SO 附件中的柜号、柜型、船名航次和截单/截关时间，然后推进补料与 AMS/ACI/ISF。",
          soStatus: SoStatus.RECOGNIZED,
          status:
            currentStatus === ShipmentStatus.BOOKING_SENT ||
            currentStatus === ShipmentStatus.WAITING_RELEASE ||
            currentStatus === ShipmentStatus.RELEASE_FOLLOWED_UP
              ? ShipmentStatus.RELEASED
              : currentStatus,
        },
        summary: "SO 回传已人工确认并写回 Shipment。仍保留人工审核记录。",
      };
    }
    case DbEmailRecognitionTypeEnum.SUPPLEMENT_CONFIRMED:
      return {
        actionType: ShipmentActionType.DOCUMENTS,
        clearExceptionKeywords: ["补料", "SI"],
        clearReminderKeywords: ["补料", "SI"],
        shipmentData: {
          aiSummary: "补料确认邮件已人工确认，SI/补料节点已闭环；下一步推进申报、截关校验和装船前跟踪。",
          documentStatus: ShipmentDocumentStatus.CONFIRMED,
          nextAction: "复核 AMS/ACI/ISF 与报关资料状态，确认截关前所有申报文件已完成。",
          status:
            currentStatus === ShipmentStatus.RELEASED ||
            currentStatus === ShipmentStatus.PENDING_DOCUMENTS ||
            currentStatus === ShipmentStatus.DOCUMENTS_SENT ||
            currentStatus === ShipmentStatus.DOCUMENTS_CONFIRMING
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
      const exceptionSummary = `邮件识别异常：${recognitionSummary}`;
      return {
        actionType: ShipmentActionType.EXCEPTION_MARK,
        exceptionMessage: exceptionSummary,
        ...buildExceptionWriteback(exceptionSummary),
        summary: "异常邮件已人工确认并写回 Shipment。",
      };
    case DbEmailRecognitionTypeEnum.UNKNOWN:
      throw new Error("Unknown recognition cannot be confirmed. Ignore or mark it as exception instead.");
  }
}
