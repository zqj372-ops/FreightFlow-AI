import { Prisma, type EmailMessage as DbEmailMessage } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type {
  CreateEmailMessageInput,
  EmailMessageRecord,
  EmailMessageRepository,
  UpdateEmailMessageSyncInput,
} from "../email-message-repository";
import type { EmailMessageSyncStatus } from "../types";

const dbToSyncStatus: Record<string, EmailMessageSyncStatus> = {
  NEW: "new",
  PARSED: "parsed",
  FAILED: "failed",
};

function toDbSyncStatus(value: EmailMessageSyncStatus) {
  return value.toUpperCase() as "NEW" | "PARSED" | "FAILED";
}

function toRecord(message: DbEmailMessage): EmailMessageRecord {
  return {
    attachments: toStringArray(message.attachments),
    bodySummary: message.bodySummary,
    bodyText: message.bodyText,
    cc: toStringArray(message.cc),
    createdAt: message.createdAt.toISOString(),
    from: message.from,
    id: message.id,
    mailbox: message.mailbox,
    messageId: message.messageId,
    receivedAt: message.receivedAt.toISOString(),
    subject: message.subject,
    syncStatus: dbToSyncStatus[message.syncStatus] ?? "new",
    threadId: message.threadId,
    to: toStringArray(message.to),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export class PrismaEmailMessageRepository implements EmailMessageRepository {
  async list(): Promise<EmailMessageRecord[]> {
    try {
      const messages = await prisma.emailMessage.findMany({ orderBy: { receivedAt: "desc" } });
      return messages.map(toRecord);
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getById(id: string): Promise<EmailMessageRecord | null> {
    try {
      const message = await prisma.emailMessage.findUnique({ where: { id } });
      return message ? toRecord(message) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async getByMessageId(messageId: string): Promise<EmailMessageRecord | null> {
    try {
      const message = await prisma.emailMessage.findUnique({ where: { messageId } });
      return message ? toRecord(message) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async create(input: CreateEmailMessageInput): Promise<EmailMessageRecord> {
    try {
      const message = await prisma.emailMessage.create({
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
          syncStatus: toDbSyncStatus(input.syncStatus),
          threadId: input.threadId,
          to: input.to as unknown as Prisma.InputJsonValue,
        },
      });
      return toRecord(message);
    } catch (error) {
      if (isPrismaUnavailable(error)) {
        return {
          ...input,
          attachments: [...input.attachments],
          cc: [...input.cc],
          createdAt: new Date().toISOString(),
          id: `prisma-fallback-msg-${Date.now()}`,
          to: [...input.to],
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  async updateSyncStatus(
    input: UpdateEmailMessageSyncInput,
  ): Promise<EmailMessageRecord | null> {
    try {
      const message = await prisma.emailMessage.update({
        where: { id: input.id },
        data: { syncStatus: toDbSyncStatus(input.syncStatus) },
      });
      return toRecord(message);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }
}
