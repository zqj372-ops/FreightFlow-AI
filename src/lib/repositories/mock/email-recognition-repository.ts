import type {
  CreateEmailRecognitionInput,
  EmailRecognitionRecord,
  EmailRecognitionRepository,
  RecognitionWithEmail,
  UpdateEmailRecognitionStatusInput,
} from "../email-recognition-repository";
import { getMockStore } from "./mock-store";

function clone(record: EmailRecognitionRecord): EmailRecognitionRecord {
  return {
    ...record,
    extractedFields: { ...record.extractedFields },
    riskFlags: [...record.riskFlags],
  };
}

function toWithEmail(record: EmailRecognitionRecord, store = getMockStore()): RecognitionWithEmail {
  const message = store.emailMessages.find((entry) => entry.id === record.emailMessageId);
  if (!message) {
    throw new Error(`Email message ${record.emailMessageId} not found for recognition ${record.id}`);
  }
  return {
    ...clone(record),
    emailMessage: {
      bodyText: message.bodyText,
      from: message.from,
      id: message.id,
      messageId: message.messageId,
      receivedAt: message.receivedAt,
      subject: message.subject,
    },
  };
}

export class MockEmailRecognitionRepository implements EmailRecognitionRepository {
  async listPending() {
    return getMockStore()
      .recognitions.filter((recognition) => recognition.status === "pending_review")
      .map((recognition) => toWithEmail(recognition));
  }

  async getById(id: string) {
    const record = getMockStore().recognitions.find((entry) => entry.id === id);
    return record ? toWithEmail(record) : null;
  }

  async create(input: CreateEmailRecognitionInput) {
    const store = getMockStore();
    const now = new Date().toISOString();
    const record: EmailRecognitionRecord = {
      ...input,
      createdAt: now,
      extractedFields: { ...input.extractedFields },
      id: `mock-rec-${store.recognitions.length + 1}-${Date.now()}`,
      reviewedAt: null,
      reviewedBy: null,
      riskFlags: [...input.riskFlags],
      updatedAt: now,
    };
    store.recognitions.push(record);
    return clone(record);
  }

  async updateStatus(input: UpdateEmailRecognitionStatusInput) {
    const store = getMockStore();
    const index = store.recognitions.findIndex((entry) => entry.id === input.id);
    if (index < 0) return null;
    const current = store.recognitions[index];
    const next: EmailRecognitionRecord = {
      ...current,
      reviewedAt: input.reviewedAt !== undefined ? input.reviewedAt : current.reviewedAt,
      reviewedBy: input.reviewedBy !== undefined ? input.reviewedBy : current.reviewedBy,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    store.recognitions[index] = next;
    return clone(next);
  }
}
