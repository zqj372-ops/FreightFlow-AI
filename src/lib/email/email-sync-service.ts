import { createHash } from "node:crypto";

import { ActionSource, Prisma, ShipmentActionType } from "@prisma/client";

import type { EmailConfig } from "@/lib/email-config";
import { applyShipmentAction } from "@/lib/freightflow-domain";
import { shipmentInclude, shipmentUpdateData, toShipmentRecord } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

import { findSoAttachments, type EmailAttachment } from "./attachment-detector";
import type { ParsedEmailMessage } from "./email-parser";
import {
  matchEmailToShipment,
  normalizeEmailMessageId,
  type ShipmentThreadSignal,
} from "./email-thread-matcher";

type EmailSyncItem = {
  dedupeMessageId: string;
  message: ParsedEmailMessage;
  match: ReturnType<typeof matchEmailToShipment>;
  soAttachments: EmailAttachment[];
};

export type CreatedSoDocumentSummary = {
  emailMessageId: string;
  fileName: string;
  shipmentId: string;
  soDocumentId: string;
};

export type EmailSyncPersistenceResult = {
  createdDocuments: CreatedSoDocumentSummary[];
  duplicateMessages: string[];
  failedMessageIds: string[];
  matchedCount: number;
  storedMessageCount: number;
  syncLogId: string | null;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function optionalJson(value: unknown) {
  if (Array.isArray(value) && value.length === 0) return undefined;
  if (value === undefined || value === null || value === "") return undefined;

  return jsonValue(value);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function parseReceivedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getMessageFingerprint(message: ParsedEmailMessage) {
  return [
    message.from,
    message.subject,
    message.receivedAt,
    message.body.slice(0, 500),
    message.attachments.map((attachment) => attachment.fileName).sort().join(","),
  ].join("|");
}

export function getEmailMessageDedupeId(message: ParsedEmailMessage) {
  const providerMessageId = normalizeEmailMessageId(message.messageId);

  if (providerMessageId) return truncate(providerMessageId, 512);

  const hash = createHash("sha256").update(getMessageFingerprint(message)).digest("hex").slice(0, 40);
  return `generated:${hash}`;
}

export function getEmailMailboxName(config: EmailConfig) {
  return config.username || config.imapHost || "local-sample";
}

export function createEmailAttachmentStoragePath(emailMessageId: string, fileName: string) {
  return `email://${emailMessageId}/${encodeURIComponent(fileName)}`;
}

export function prepareEmailSyncItems({
  messages,
  shipments,
  threadSignals = [],
}: {
  messages: ParsedEmailMessage[];
  shipments: ShipmentRecord[];
  threadSignals?: ShipmentThreadSignal[];
}): EmailSyncItem[] {
  return messages.map((message) => {
    const match = matchEmailToShipment(message, shipments, threadSignals);

    return {
      dedupeMessageId: getEmailMessageDedupeId(message),
      message,
      match,
      soAttachments: match ? findSoAttachments(message.attachments) : [],
    };
  });
}

export async function loadShipmentThreadSignals(): Promise<ShipmentThreadSignal[]> {
  const shipments = await prisma.shipment.findMany({
    select: {
      id: true,
      bookingEmailDrafts: {
        select: { subject: true },
        where: { status: "SENT" },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      emailLogs: {
        select: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      emailMessages: {
        select: {
          messageId: true,
          subject: true,
          threadId: true,
        },
        orderBy: { receivedAt: "desc" },
        take: 20,
      },
    },
  });

  return shipments.map((shipment) => ({
    messageIds: shipment.emailMessages.flatMap((message) => [message.messageId, message.threadId ?? ""]).filter(Boolean),
    shipmentId: shipment.id,
    subjects: [
      ...shipment.bookingEmailDrafts.map((draft) => draft.subject),
      ...shipment.emailLogs.map((log) => log.subject),
      ...shipment.emailMessages.map((message) => message.subject),
    ],
  }));
}

export async function persistEmailSyncItems({
  items,
  mailbox,
  startedAt,
}: {
  items: EmailSyncItem[];
  mailbox: string;
  startedAt: Date;
}): Promise<EmailSyncPersistenceResult> {
  const matchedCount = items.filter((item) => item.match).length;
  const attachmentCount = items.reduce((total, item) => total + item.soAttachments.length, 0);
  const syncLog = await prisma.emailSyncLog.create({
    data: {
      mailbox,
      status: "RUNNING",
      matchedCount,
      attachmentCount,
      startedAt,
    },
    select: { id: true },
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const existingMessages = await tx.emailMessage.findMany({
        where: {
          mailbox,
          messageId: { in: items.map((item) => item.dedupeMessageId) },
        },
        select: { messageId: true },
      });
      const existingMessageIds = new Set(existingMessages.map((message) => message.messageId));
      const createdDocuments: CreatedSoDocumentSummary[] = [];
      const duplicateMessages: string[] = [];
      const failedMessageIds: string[] = [];
      let storedMessageCount = 0;

      for (const item of items) {
        if (existingMessageIds.has(item.dedupeMessageId)) {
          duplicateMessages.push(item.dedupeMessageId);
          continue;
        }

        const match = item.match;
        const emailMessage = await tx.emailMessage.create({
          data: {
            shipmentId: match?.shipment.id ?? null,
            mailbox,
            messageId: truncate(item.dedupeMessageId, 512),
            threadId: item.message.threadId ? truncate(item.message.threadId, 512) : null,
            inReplyTo: item.message.inReplyTo ? truncate(item.message.inReplyTo, 512) : null,
            references: optionalJson(item.message.references),
            subject: truncate(item.message.subject, 255),
            from: truncate(item.message.from, 255),
            to: optionalJson(item.message.to),
            cc: optionalJson(item.message.cc),
            body: item.message.body,
            receivedAt: parseReceivedAt(item.message.receivedAt),
            attachments: optionalJson(item.message.attachments),
            hasSoAttachment: item.soAttachments.length > 0,
            matchScore: match?.score ?? null,
          },
          select: { id: true },
        });
        storedMessageCount += 1;
        existingMessageIds.add(item.dedupeMessageId);

        if (!match || item.soAttachments.length === 0) continue;

        for (const attachment of item.soAttachments) {
          const document = await tx.soDocument.create({
            data: {
              shipmentId: match.shipment.id,
              fileName: truncate(attachment.fileName, 255),
              mimeType: truncate(attachment.contentType ?? "application/octet-stream", 128),
              storagePath: createEmailAttachmentStoragePath(emailMessage.id, attachment.fileName),
              source: "EMAIL_ATTACHMENT",
              ocrStatus: "PENDING",
              status: "RECEIVED",
            },
            select: { id: true },
          });

          createdDocuments.push({
            emailMessageId: emailMessage.id,
            fileName: attachment.fileName,
            shipmentId: match.shipment.id,
            soDocumentId: document.id,
          });
        }

        const before = await tx.shipment.findUnique({ where: { id: match.shipment.id }, include: shipmentInclude });
        if (!before) continue;

        const beforeRecord = toShipmentRecord(before);
        const action = applyShipmentAction(beforeRecord, { action: "SO 识别", soStage: "received", source: "SYSTEM" });
        const after = await tx.shipment.update({
          where: { id: match.shipment.id },
          data: shipmentUpdateData(action.record),
          include: shipmentInclude,
        });

        await tx.shipmentActionLog.create({
          data: {
            shipmentId: match.shipment.id,
            actionType: ShipmentActionType.SO_RECEIVED,
            source: ActionSource.SYSTEM,
            summary: `${action.summary}：${item.soAttachments.map((attachment) => attachment.fileName).join(", ")}`,
            beforeSnapshot: jsonValue(beforeRecord),
            afterSnapshot: jsonValue(toShipmentRecord(after)),
          },
        });
      }

      await tx.emailSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "SUCCESS",
          matchedCount,
          attachmentCount: createdDocuments.length,
          completedAt: new Date(),
        },
      });

      return {
        createdDocuments,
        duplicateMessages,
        failedMessageIds,
        matchedCount,
        storedMessageCount,
        syncLogId: syncLog.id,
      };
    });
  } catch (error) {
    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Failed to persist synced email messages.",
        completedAt: new Date(),
      },
    }).catch(() => undefined);

    throw error;
  }
}
