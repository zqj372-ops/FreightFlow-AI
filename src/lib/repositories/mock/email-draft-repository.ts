import type {
  CreateEmailDraftInput,
  EmailDraftRecord,
  EmailDraftRepository,
  MarkSentInput,
  UpdateEmailDraftInput,
} from "../email-draft-repository";
import { getMockStore } from "./mock-store";

function clone(record: EmailDraftRecord): EmailDraftRecord {
  return {
    ...record,
    cc: [...record.cc],
    to: [...record.to],
  };
}

export class MockEmailDraftRepository implements EmailDraftRepository {
  async list() {
    return getMockStore().drafts.map(clone);
  }

  async getById(id: string) {
    const record = getMockStore().drafts.find((draft) => draft.id === id);
    return record ? clone(record) : null;
  }

  async create(input: CreateEmailDraftInput) {
    const store = getMockStore();
    const now = new Date().toISOString();
    const record: EmailDraftRecord = {
      attachmentName: input.attachmentName,
      body: input.body,
      cc: [...input.cc],
      createdAt: now,
      createdFromPlanId: input.createdFromPlanId,
      id: `mock-draft-${store.drafts.length + 1}-${Date.now()}`,
      lastError: null,
      sentEmailLogId: null,
      shipmentId: input.shipmentId,
      status: input.status,
      subject: input.subject,
      to: [...input.to],
      updatedAt: now,
    };
    store.drafts.push(record);
    return clone(record);
  }

  async update(id: string, input: UpdateEmailDraftInput) {
    const store = getMockStore();
    const index = store.drafts.findIndex((draft) => draft.id === id);
    if (index < 0) return null;
    const current = store.drafts[index];
    const next: EmailDraftRecord = {
      ...current,
      ...(input.attachmentName !== undefined ? { attachmentName: input.attachmentName } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.cc !== undefined ? { cc: [...input.cc] } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.to !== undefined ? { to: [...input.to] } : {}),
      updatedAt: new Date().toISOString(),
    };
    store.drafts[index] = next;
    return clone(next);
  }

  async markSent(input: MarkSentInput) {
    const store = getMockStore();
    const index = store.drafts.findIndex((draft) => draft.id === input.draftId);
    if (index < 0) return null;
    const next: EmailDraftRecord = {
      ...store.drafts[index],
      lastError: input.lastError,
      sentEmailLogId: input.emailLogId,
      status: "sent",
      updatedAt: new Date().toISOString(),
    };
    store.drafts[index] = next;
    return clone(next);
  }
}
