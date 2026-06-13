import { Prisma, type EmailRecognitionResult as DbRecognition } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type {
  CreateEmailRecognitionInput,
  EmailRecognitionRecord,
  EmailRecognitionRepository,
  RecognitionWithEmail,
  UpdateEmailRecognitionStatusInput,
} from "../email-recognition-repository";
import type { EmailRecognitionStatus, EmailRecognitionType } from "../types";

const dbToRecognitionType: Record<string, EmailRecognitionType> = {
  SO_RECEIVED: "SO_RECEIVED",
  BOOKING_REPLY: "BOOKING_REPLY",
  SUPPLEMENT_CONFIRMED: "SUPPLEMENT_CONFIRMED",
  FOLLOW_UP_REPLY: "FOLLOW_UP_REPLY",
  EXCEPTION: "EXCEPTION",
  UNKNOWN: "UNKNOWN",
};

const dbToRecognitionStatus: Record<string, EmailRecognitionStatus> = {
  PENDING_REVIEW: "pending_review",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  IGNORED: "ignored",
};

function toDbRecognitionType(value: EmailRecognitionType) {
  return value as
    | "SO_RECEIVED"
    | "BOOKING_REPLY"
    | "SUPPLEMENT_CONFIRMED"
    | "FOLLOW_UP_REPLY"
    | "EXCEPTION"
    | "UNKNOWN";
}

function toDbRecognitionStatus(value: EmailRecognitionStatus) {
  return value.toUpperCase() as "PENDING_REVIEW" | "CONFIRMED" | "REJECTED" | "IGNORED";
}

function toRecord(recognition: DbRecognition & { emailMessage?: { bodyText: string; from: string; messageId: string; receivedAt: Date; subject: string } | null }): EmailRecognitionRecord {
  return {
    confidence: recognition.confidence,
    createdAt: recognition.createdAt.toISOString(),
    emailMessageId: recognition.emailMessageId,
    extractedFields: readExtractedFields(recognition.extractedFields),
    id: recognition.id,
    matchedShipmentId: recognition.matchedShipmentId,
    recognitionType: dbToRecognitionType[recognition.recognitionType] ?? "UNKNOWN",
    reviewedAt: recognition.reviewedAt?.toISOString() ?? null,
    reviewedBy: recognition.reviewedBy,
    riskFlags: readStringArray(recognition.riskFlags),
    status: dbToRecognitionStatus[recognition.status] ?? "pending_review",
    summary: recognition.summary,
    updatedAt: recognition.updatedAt.toISOString(),
  };
}

function attachEmail(
  recognition: EmailRecognitionRecord,
  email: { bodyText: string; from: string; id: string; messageId: string; receivedAt: Date; subject: string } | null,
): RecognitionWithEmail {
  return {
    ...recognition,
    emailMessage: email
      ? {
          bodyText: email.bodyText,
          from: email.from,
          id: email.id,
          messageId: email.messageId,
          receivedAt: email.receivedAt.toISOString(),
          subject: email.subject,
        }
      : {
          bodyText: "",
          from: "",
          id: recognition.emailMessageId,
          messageId: "",
          receivedAt: recognition.createdAt,
          subject: "",
        },
  };
}

function readStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readExtractedFields(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

export class PrismaEmailRecognitionRepository implements EmailRecognitionRepository {
  async listPending(): Promise<RecognitionWithEmail[]> {
    try {
      const records = await prisma.emailRecognitionResult.findMany({
        where: { status: "PENDING_REVIEW" },
        include: { emailMessage: true },
        orderBy: { createdAt: "desc" },
      });
      return records.map((rec) => attachEmail(toRecord(rec), rec.emailMessage ?? null));
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getById(id: string): Promise<RecognitionWithEmail | null> {
    try {
      const record = await prisma.emailRecognitionResult.findUnique({
        where: { id },
        include: { emailMessage: true },
      });
      if (!record) return null;
      return attachEmail(toRecord(record), record.emailMessage ?? null);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async create(input: CreateEmailRecognitionInput): Promise<EmailRecognitionRecord> {
    try {
      const record = await prisma.emailRecognitionResult.create({
        data: {
          confidence: input.confidence,
          emailMessageId: input.emailMessageId,
          extractedFields: input.extractedFields as unknown as Prisma.InputJsonValue,
          matchedShipmentId: input.matchedShipmentId,
          recognitionType: toDbRecognitionType(input.recognitionType),
          riskFlags: input.riskFlags as unknown as Prisma.InputJsonValue,
          status: toDbRecognitionStatus(input.status),
          summary: input.summary,
        },
      });
      return toRecord(record);
    } catch (error) {
      if (isPrismaUnavailable(error)) {
        return {
          ...input,
          createdAt: new Date().toISOString(),
          extractedFields: { ...input.extractedFields },
          id: `prisma-fallback-rec-${Date.now()}`,
          reviewedAt: null,
          reviewedBy: null,
          riskFlags: [...input.riskFlags],
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  async updateStatus(
    input: UpdateEmailRecognitionStatusInput,
  ): Promise<EmailRecognitionRecord | null> {
    try {
      const record = await prisma.emailRecognitionResult.update({
        where: { id: input.id },
        data: {
          reviewedAt: input.reviewedAt === undefined ? undefined : input.reviewedAt ? new Date(input.reviewedAt) : null,
          reviewedBy: input.reviewedBy === undefined ? undefined : input.reviewedBy,
          status: toDbRecognitionStatus(input.status),
        },
      });
      return toRecord(record);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }
}
