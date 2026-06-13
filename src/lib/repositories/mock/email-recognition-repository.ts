import type {
  CreateEmailRecognitionInput,
  EmailRecognitionRecord,
  EmailRecognitionRepository,
  RecognitionWithEmail,
  UpdateEmailRecognitionStatusInput,
} from "../email-recognition-repository";
import { getMockStore } from "./mock-store";

function nowIso() {
  return new Date().toISOString();
}

function attachEmailMessage(
  record: EmailRecognitionRecord,
  emailMap: Map<string, EmailRecognitionRecord["emailMessageId"] extends string
    ? Awaited<ReturnType<EmailRecognitionRepository["getById"]>>
    : never>,
): RecognitionWithEmail {
  // Re-derive the email payload from the mock store via messageId
  // lookup so the join is faithful to the prisma adapter.
  const store = getMockStore();
  const email = store.emailMessages.find((m) => m.id === record.emailMessageId);

  return {
    ...record,
    emailMessage: email
      ? {
          bodyText: email.bodyText,
          from: email.from,
          id: email.id,
          messageId: email.messageId,
          receivedAt: email.receivedAt,
          subject: email.subject,
        }
      : {
          bodyText: "",
          from: "",
          id: record.emailMessageId,
          messageId: "",
          receivedAt: record.createdAt,
          subject: "",
        },
  };
  // `emailMap` retained for symmetry with prisma adapter; unused in mock
  void emailMap;
}

export class MockEmailRecognitionRepository implements EmailRecognitionRepository {
  async listPending(): Promise<RecognitionWithEmail[]> {
    const store = getMockStore();
    const emailMap = new Map<string, never>();
    return store.recognitions
      .filter((r) => r.status === "pending_review")
      .map((record) => attachEmailMessage(structuredClone(record), emailMap));
  }

  async getById(id: string): Promise<RecognitionWithEmail | null> {
    const store = getMockStore();
    const found = store.recognitions.find((r) => r.id === id);
    if (!found) return null;
    const emailMap = new Map<string, never>();
    return attachEmailMessage(structuredClone(found), emailMap);
  }

  async create(input: CreateEmailRecognitionInput): Promise<EmailRecognitionRecord> {
    const store = getMockStore();
    const now = nowIso();
    const id = `mock-rec-${store.recognitions.length + 1}`;
    const next: EmailRecognitionRecord = {
      ...input,
      createdAt: now,
      extractedFields: { ...input.extractedFields },
      id,
      reviewedAt: null,
      reviewedBy: null,
      riskFlags: [...input.riskFlags],
      updatedAt: now,
    };
    store.recognitions.push(next);
    return structuredClone(next);
  }

  async updateStatus(
    input: UpdateEmailRecognitionStatusInput,
  ): Promise<EmailRecognitionRecord | null> {
    const store = getMockStore();
    const index = store.recognitions.findIndex((r) => r.id === input.id);
    if (index === -1) return null;

    const current = store.recognitions[index]!;
    const next: EmailRecognitionRecord = {
      ...current,
      reviewedAt: input.reviewedAt === undefined ? current.reviewedAt : input.reviewedAt,
      reviewedBy: input.reviewedBy === undefined ? current.reviewedBy : input.reviewedBy,
      status: input.status,
      updatedAt: nowIso(),
    };
    store.recognitions[index] = next;
    return structuredClone(next);
  }
}
