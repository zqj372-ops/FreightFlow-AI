import { EmailDraftStatus as DbEmailDraftStatus, EmailDraftType as DbEmailDraftType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  CreateEmailDraftInput,
  EmailDraftRecord,
  EmailDraftRepository,
  EmailDraftStatus,
  MarkSentInput,
  UpdateEmailDraftInput,
} from "../email-draft-repository";

const draftStatusToDb: Record<EmailDraftStatus, DbEmailDraftStatus> = {
  draft: DbEmailDraftStatus.DRAFT,
  failed: DbEmailDraftStatus.FAILED,
  pending_review: DbEmailDraftStatus.PENDING_REVIEW,
  sent: DbEmailDraftStatus.SENT,
};

const dbStatusToUi: Record<DbEmailDraftStatus, EmailDraftStatus> = {
  [DbEmailDraftStatus.DRAFT]: "draft",
  [DbEmailDraftStatus.FAILED]: "failed",
  [DbEmailDraftStatus.PENDING_REVIEW]: "pending_review",
  [DbEmailDraftStatus.SENT]: "sent",
};

const draftTypeToDb: Record<CreateEmailDraftInput["draftType"], DbEmailDraftType> = {
  booking: DbEmailDraftType.BOOKING,
  follow_up: DbEmailDraftType.FOLLOW_UP,
  supplement: DbEmailDraftType.SUPPLEMENT,
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toRecord(record: {
  attachments: unknown;
  body: string;
  cc: unknown;
  createdAt: Date;
  createdFromPlanId: string | null;
  id: string;
  lastError: string | null;
  sentEmailLogId: string | null;
  shipmentId: string;
  status: DbEmailDraftStatus;
  subject: string;
  to: unknown;
  updatedAt: Date;
}): EmailDraftRecord {
  const attachments = asStringArray(record.attachments);
  return {
    attachmentName: attachments[0] ?? "",
    body: record.body,
    cc: asStringArray(record.cc),
    createdAt: record.createdAt.toISOString(),
    createdFromPlanId: record.createdFromPlanId,
    id: record.id,
    lastError: record.lastError,
    sentEmailLogId: record.sentEmailLogId,
    shipmentId: record.shipmentId,
    status: dbStatusToUi[record.status],
    subject: record.subject,
    to: asStringArray(record.to),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PrismaEmailDraftRepository implements EmailDraftRepository {
  async list(): Promise<EmailDraftRecord[]> {
    const records = await prisma.emailDraft.findMany({ orderBy: { createdAt: "desc" } });
    return records.map(toRecord);
  }

  async getById(id: string): Promise<EmailDraftRecord | null> {
    const record = await prisma.emailDraft.findUnique({ where: { id } });
    return record ? toRecord(record) : null;
  }

  async create(input: CreateEmailDraftInput): Promise<EmailDraftRecord> {
    const created = await prisma.emailDraft.create({
      data: {
        attachments: input.attachmentName ? ([input.attachmentName] as unknown as Prisma.InputJsonValue) : [],
        body: input.body,
        cc: input.cc as unknown as Prisma.InputJsonValue,
        createdFromPlanId: input.createdFromPlanId,
        draftType: draftTypeToDb[input.draftType],
        shipmentId: input.shipmentId,
        status: draftStatusToDb[input.status],
        subject: input.subject,
        to: input.to as unknown as Prisma.InputJsonValue,
      },
    });
    return toRecord(created);
  }

  async update(id: string, input: UpdateEmailDraftInput): Promise<EmailDraftRecord | null> {
    try {
      const data: Prisma.EmailDraftUpdateInput = {
        ...(input.attachmentName !== undefined
          ? { attachments: input.attachmentName ? ([input.attachmentName] as unknown as Prisma.InputJsonValue) : [] }
          : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.cc !== undefined ? { cc: input.cc as unknown as Prisma.InputJsonValue } : {}),
        ...(input.status !== undefined ? { status: draftStatusToDb[input.status] } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.to !== undefined ? { to: input.to as unknown as Prisma.InputJsonValue } : {}),
      };
      const updated = await prisma.emailDraft.update({ data, where: { id } });
      return toRecord(updated);
    } catch {
      return null;
    }
  }

  async markSent(input: MarkSentInput): Promise<EmailDraftRecord | null> {
    try {
      const updated = await prisma.emailDraft.update({
        data: {
          lastError: input.lastError,
          sentEmailLogId: input.emailLogId,
          status: DbEmailDraftStatus.SENT,
        },
        where: { id: input.draftId },
      });
      return toRecord(updated);
    } catch {
      return null;
    }
  }
}
