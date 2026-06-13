import { Prisma, type EmailDraft as DbEmailDraft } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type {
  CreateEmailDraftInput,
  EmailDraftRecord,
  EmailDraftRepository,
  MarkSentInput,
  UpdateEmailDraftInput,
} from "../email-draft-repository";
import type { EmailDraftStatus, EmailDraftType } from "../types";

const dbToDraftStatus: Record<string, EmailDraftStatus> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending_review",
  SENT: "sent",
  FAILED: "failed",
};

const dbToDraftType: Record<string, EmailDraftType> = {
  BOOKING: "booking",
  FOLLOW_UP: "follow_up",
  SUPPLEMENT: "supplement",
};

function toDbDraftStatus(value: EmailDraftStatus) {
  return value.toUpperCase() as "DRAFT" | "PENDING_REVIEW" | "SENT" | "FAILED";
}

function toDbDraftType(value: EmailDraftType) {
  return value.toUpperCase() as "BOOKING" | "FOLLOW_UP" | "SUPPLEMENT";
}

function toRecord(draft: DbEmailDraft): EmailDraftRecord {
  return {
    attachmentName: null,
    body: draft.body,
    cc: toStringArray(draft.cc),
    createdAt: draft.createdAt.toISOString(),
    createdFromPlanId: draft.createdFromPlanId,
    draftType: dbToDraftType[draft.draftType] ?? "booking",
    id: draft.id,
    lastError: draft.lastError,
    sentEmailLogId: draft.sentEmailLogId,
    shipmentId: draft.shipmentId,
    status: dbToDraftStatus[draft.status] ?? "draft",
    subject: draft.subject,
    to: toStringArray(draft.to),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export class PrismaEmailDraftRepository implements EmailDraftRepository {
  async list(): Promise<EmailDraftRecord[]> {
    try {
      const drafts = await prisma.emailDraft.findMany({ orderBy: { updatedAt: "desc" } });
      return drafts.map(toRecord);
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getById(id: string): Promise<EmailDraftRecord | null> {
    try {
      const draft = await prisma.emailDraft.findUnique({ where: { id } });
      return draft ? toRecord(draft) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async create(input: CreateEmailDraftInput): Promise<EmailDraftRecord> {
    try {
      const draft = await prisma.emailDraft.create({
        data: {
          attachments: [] as unknown as Prisma.InputJsonValue,
          body: input.body,
          cc: input.cc as unknown as Prisma.InputJsonValue,
          createdFromPlanId: input.createdFromPlanId,
          draftType: toDbDraftType(input.draftType),
          lastError: null,
          sentEmailLogId: null,
          shipmentId: input.shipmentId,
          status: toDbDraftStatus(input.status),
          subject: input.subject,
          to: input.to as unknown as Prisma.InputJsonValue,
        },
      });
      return toRecord(draft);
    } catch (error) {
      if (isPrismaUnavailable(error)) {
        // In-memory fallback so the call site can keep working when the
        // DB is unreachable. Mirrors the mock adapter's behaviour.
        return {
          attachmentName: null,
          body: input.body,
          cc: [...input.cc],
          createdAt: new Date().toISOString(),
          createdFromPlanId: input.createdFromPlanId,
          draftType: input.draftType,
          id: `prisma-fallback-draft-${Date.now()}`,
          lastError: null,
          sentEmailLogId: null,
          shipmentId: input.shipmentId,
          status: input.status,
          subject: input.subject,
          to: [...input.to],
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateEmailDraftInput): Promise<EmailDraftRecord | null> {
    try {
      const draft = await prisma.emailDraft.update({
        where: { id },
        data: {
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.subject !== undefined ? { subject: input.subject } : {}),
          ...(input.status !== undefined ? { status: toDbDraftStatus(input.status) } : {}),
          ...(input.to !== undefined ? { to: input.to as unknown as Prisma.InputJsonValue } : {}),
          ...(input.cc !== undefined ? { cc: input.cc as unknown as Prisma.InputJsonValue } : {}),
        },
      });
      return toRecord(draft);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async markSent(input: MarkSentInput): Promise<EmailDraftRecord | null> {
    try {
      const draft = await prisma.emailDraft.update({
        where: { id: input.draftId },
        data: {
          lastError: input.lastError,
          sentEmailLogId: input.emailLogId,
          status: "SENT",
        },
      });
      return toRecord(draft);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }
}
