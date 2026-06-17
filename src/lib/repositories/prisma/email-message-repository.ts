import { EmailMessageSyncStatus as DbEmailMessageSyncStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  CreateEmailMessageInput,
  EmailMessageRecord,
  EmailMessageRepository,
  EmailMessageSyncStatus,
  UpdateEmailMessageSyncInput,
} from "../email-message-repository";

const syncStatusToDb: Record<EmailMessageSyncStatus, DbEmailMessageSyncStatus> = {
  confirmed: DbEmailMessageSyncStatus.CONFIRMED,
  failed: DbEmailMessageSyncStatus.FAILED,
  ignored: DbEmailMessageSyncStatus.IGNORED,
  new: DbEmailMessageSyncStatus.NEW,
  parsed: DbEmailMessageSyncStatus.PARSED,
  queued: DbEmailMessageSyncStatus.QUEUED,
};

const dbSyncStatusToUi: Record<DbEmailMessageSyncStatus, EmailMessageSyncStatus> = {
  [DbEmailMessageSyncStatus.CONFIRMED]: "confirmed",
  [DbEmailMessageSyncStatus.FAILED]: "failed",
  [DbEmailMessageSyncStatus.IGNORED]: "ignored",
  [DbEmailMessageSyncStatus.NEW]: "new",
  [DbEmailMessageSyncStatus.PARSED]: "parsed",
  [DbEmailMessageSyncStatus.QUEUED]: "queued",
};

function toRecord(record: {
  attachments: unknown;
  bodySummary: string;
  bodyText: string;
  cc: unknown;
  createdAt: Date;
  from: string;
  id: string;
  mailbox: string;
  messageId: string;
  receivedAt: Date;
  subject: string;
  syncStatus: DbEmailMessageSyncStatus;
  threadId: string | null;
  to: unknown;
  updatedAt: Date;
}): EmailMessageRecord {
  return {
    attachments: Array.isArray(record.attachments)
      ? record.attachments.filter((item): item is string => typeof item === "string")
      : [],
    bodySummary: record.bodySummary,
    bodyText: record.bodyText,
    cc: Array.isArray(record.cc)
      ? record.cc.filter((item): item is string => typeof item === "string")
      : [],
    createdAt: record.createdAt.toISOString(),
    from: record.from,
    id: record.id,
    mailbox: record.mailbox,
    messageId: record.messageId,
    receivedAt: record.receivedAt.toISOString(),
    subject: record.subject,
    syncStatus: dbSyncStatusToUi[record.syncStatus],
    threadId: record.threadId,
    to: Array.isArray(record.to)
      ? record.to.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PrismaEmailMessageRepository implements EmailMessageRepository {
  async list(): Promise<EmailMessageRecord[]> {
    const records = await prisma.emailMessage.findMany({ orderBy: { receivedAt: "desc" } });
    return records.map(toRecord);
  }

  async getById(id: string): Promise<EmailMessageRecord | null> {
    const record = await prisma.emailMessage.findUnique({ where: { id } });
    return record ? toRecord(record) : null;
  }

  async getByMessageId(messageId: string): Promise<EmailMessageRecord | null> {
    const record = await prisma.emailMessage.findUnique({ where: { messageId } });
    return record ? toRecord(record) : null;
  }

  async create(input: CreateEmailMessageInput): Promise<EmailMessageRecord> {
    const created = await prisma.emailMessage.create({
      data: {
        attachments: input.attachments as unknown as Prisma.InputJsonValue,
        bodySummary: input.bodySummary,
        bodyText: input.bodyText,
        cc: input.cc as unknown as Prisma.InputJsonValue,
        from: input.from,
        mailbox: input.mailbox,
        messageId: input.messageId,
        receivedAt: new Date(input.receivedAt),
        subject: input.subject,
        syncStatus: syncStatusToDb[input.syncStatus],
        threadId: input.threadId,
        to: input.to as unknown as Prisma.InputJsonValue,
      },
    });
    return toRecord(created);
  }

  async updateSyncStatus(input: UpdateEmailMessageSyncInput): Promise<EmailMessageRecord | null> {
    try {
      const updated = await prisma.emailMessage.update({
        data: { syncStatus: syncStatusToDb[input.syncStatus] },
        where: { id: input.id },
      });
      return toRecord(updated);
    } catch {
      return null;
    }
  }
}
