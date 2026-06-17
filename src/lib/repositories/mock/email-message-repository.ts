import type {
  CreateEmailMessageInput,
  EmailMessageRecord,
  EmailMessageRepository,
  UpdateEmailMessageSyncInput,
} from "../email-message-repository";
import { getMockStore } from "./mock-store";

function clone(record: EmailMessageRecord): EmailMessageRecord {
  return {
    ...record,
    attachments: [...record.attachments],
    cc: [...record.cc],
    to: [...record.to],
  };
}

export class MockEmailMessageRepository implements EmailMessageRepository {
  async list() {
    return getMockStore().emailMessages.map(clone);
  }

  async getById(id: string) {
    const record = getMockStore().emailMessages.find((message) => message.id === id);
    return record ? clone(record) : null;
  }

  async getByMessageId(messageId: string) {
    const record = getMockStore().emailMessages.find((message) => message.messageId === messageId);
    return record ? clone(record) : null;
  }

  async create(input: CreateEmailMessageInput) {
    const store = getMockStore();
    const now = new Date().toISOString();
    const record: EmailMessageRecord = {
      ...input,
      attachments: [...input.attachments],
      cc: [...input.cc],
      createdAt: input.receivedAt ?? now,
      id: `mock-email-${store.emailMessages.length + 1}-${Date.now()}`,
      to: [...input.to],
      updatedAt: now,
    };
    store.emailMessages.push(record);
    return clone(record);
  }

  async updateSyncStatus(input: UpdateEmailMessageSyncInput) {
    const store = getMockStore();
    const index = store.emailMessages.findIndex((message) => message.id === input.id);
    if (index < 0) return null;
    const next: EmailMessageRecord = {
      ...store.emailMessages[index],
      syncStatus: input.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    store.emailMessages[index] = next;
    return clone(next);
  }
}
