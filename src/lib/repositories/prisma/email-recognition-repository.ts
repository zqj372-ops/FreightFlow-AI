import {
  EmailRecognitionStatus as DbEmailRecognitionStatus,
  Prisma,
  type EmailRecognitionType as DbEmailRecognitionType,
} from "@prisma/client";

import type { EmailRecognitionType } from "@/features/freightflow/email-recognition-rules";
import { prisma } from "@/lib/prisma";

import type {
  CreateEmailRecognitionInput,
  EmailRecognitionRecord,
  EmailRecognitionRepository,
  EmailRecognitionStatus,
  RecognitionWithEmail,
  UpdateEmailRecognitionStatusInput,
} from "../email-recognition-repository";

const statusToDb: Record<EmailRecognitionStatus, DbEmailRecognitionStatus> = {
  confirmed: DbEmailRecognitionStatus.CONFIRMED,
  ignored: DbEmailRecognitionStatus.IGNORED,
  pending_review: DbEmailRecognitionStatus.PENDING_REVIEW,
  rejected: DbEmailRecognitionStatus.REJECTED,
};

const dbStatusToUi: Record<DbEmailRecognitionStatus, EmailRecognitionStatus> = {
  [DbEmailRecognitionStatus.CONFIRMED]: "confirmed",
  [DbEmailRecognitionStatus.IGNORED]: "ignored",
  [DbEmailRecognitionStatus.PENDING_REVIEW]: "pending_review",
  [DbEmailRecognitionStatus.REJECTED]: "rejected",
};

function dbTypeToUi(type: DbEmailRecognitionType): EmailRecognitionType {
  return type as EmailRecognitionType;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function toRecord(record: {
  confidence: number;
  createdAt: Date;
  emailMessageId: string;
  extractedFields: unknown;
  id: string;
  matchedShipmentId: string | null;
  recognitionType: DbEmailRecognitionType;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  riskFlags: unknown;
  status: DbEmailRecognitionStatus;
  summary: string;
  updatedAt: Date;
}): EmailRecognitionRecord {
  return {
    confidence: record.confidence,
    createdAt: record.createdAt.toISOString(),
    emailMessageId: record.emailMessageId,
    extractedFields: asFields(record.extractedFields),
    id: record.id,
    matchedShipmentId: record.matchedShipmentId,
    recognitionType: dbTypeToUi(record.recognitionType),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedBy: record.reviewedBy,
    riskFlags: asStringArray(record.riskFlags),
    status: dbStatusToUi[record.status],
    summary: record.summary,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PrismaEmailRecognitionRepository implements EmailRecognitionRepository {
  async listPending(): Promise<RecognitionWithEmail[]> {
    const records = await prisma.emailRecognitionResult.findMany({
      include: { emailMessage: true },
      orderBy: { createdAt: "desc" },
      where: { status: DbEmailRecognitionStatus.PENDING_REVIEW },
    });
    return records.map((record) => ({
      ...toRecord(record),
      emailMessage: {
        bodyText: record.emailMessage.bodyText,
        from: record.emailMessage.from,
        id: record.emailMessage.id,
        messageId: record.emailMessage.messageId,
        receivedAt: record.emailMessage.receivedAt.toISOString(),
        subject: record.emailMessage.subject,
      },
    }));
  }

  async getById(id: string): Promise<RecognitionWithEmail | null> {
    const record = await prisma.emailRecognitionResult.findUnique({
      include: { emailMessage: true },
      where: { id },
    });
    if (!record) return null;
    return {
      ...toRecord(record),
      emailMessage: {
        bodyText: record.emailMessage.bodyText,
        from: record.emailMessage.from,
        id: record.emailMessage.id,
        messageId: record.emailMessage.messageId,
        receivedAt: record.emailMessage.receivedAt.toISOString(),
        subject: record.emailMessage.subject,
      },
    };
  }

  async create(input: CreateEmailRecognitionInput): Promise<EmailRecognitionRecord> {
    const created = await prisma.emailRecognitionResult.create({
      data: {
        confidence: input.confidence,
        emailMessageId: input.emailMessageId,
        extractedFields: input.extractedFields as unknown as Prisma.InputJsonValue,
        matchedShipmentId: input.matchedShipmentId,
        recognitionType: input.recognitionType as unknown as DbEmailRecognitionType,
        riskFlags: input.riskFlags as unknown as Prisma.InputJsonValue,
        status: DbEmailRecognitionStatus.PENDING_REVIEW,
        summary: input.summary,
      },
    });
    return toRecord(created);
  }

  async updateStatus(input: UpdateEmailRecognitionStatusInput): Promise<EmailRecognitionRecord | null> {
    try {
      const updated = await prisma.emailRecognitionResult.update({
        data: {
          reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : undefined,
          reviewedBy: input.reviewedBy ?? undefined,
          status: statusToDb[input.status],
        },
        where: { id: input.id },
      });
      return toRecord(updated);
    } catch {
      return null;
    }
  }
}
