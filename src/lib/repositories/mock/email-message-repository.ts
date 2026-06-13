import type {
  CreateEmailMessageInput,
  EmailMessageRecord,
  EmailMessageRepository,
  UpdateEmailMessageSyncInput,
} from "../email-message-repository";
import { getMockStore } from "./mock-store";

function nowIso() {
  return new Date().toISOString();
}

export class MockEmailMessageRepository implements EmailMessageRepository {
  async list(): Promise<EmailMessageRecord[]> {
    return getMockStore()
      .emailMessages.map((msg) => structuredClone(msg))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async getById(id: string): Promise<EmailMessageRecord | null> {
    const found = getMockStore().emailMessages.find((m) => m.id === id);
    return found ? structuredClone(found) : null;
  }

  async getByMessageId(messageId: string): Promise<EmailMessageRecord | null> {
    const found = getMockStore().emailMessages.find((m) => m.messageId === messageId);
    return found ? structuredClone(found) : null;
  }

  async create(input: CreateEmailMessageInput): Promise<EmailMessageRecord> {
    const store = getMockStore();
    const now = nowIso();
    const id = `mock-email-${store.emailMessages.length + 1}`;
    const next: EmailMessageRecord = {
      ...input,
      attachments: [...input.attachments],
      cc: [...input.cc],
      createdAt: now,
      id,
      to: [...input.to],
      updatedAt: now,
    };
    store.emailMessages.push(next);
    return structuredClone(next);
  }

  async updateSyncStatus(
    input: UpdateEmailMessageSyncInput,
  ): Promise<EmailMessageRecord | null> {
    const store = getMockStore();
    const index = store.emailMessages.findIndex((m) => m.id === input.id);
    if (index === -1) return null;

    const current = store.emailMessages[index]!;
    const next: EmailMessageRecord = {
      ...current,
      syncStatus: input.syncStatus,
      updatedAt: nowIso(),
    };
    store.emailMessages[index] = next;
    return structuredClone(next);
  }
}
