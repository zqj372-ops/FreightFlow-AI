import type {
  CreateEmailDraftInput,
  EmailDraftRecord,
  EmailDraftRepository,
  MarkSentInput,
  UpdateEmailDraftInput,
} from "../email-draft-repository";
import { getMockStore } from "./mock-store";

function nowIso() {
  return new Date().toISOString();
}

export class MockEmailDraftRepository implements EmailDraftRepository {
  async list(): Promise<EmailDraftRecord[]> {
    return getMockStore().drafts.map((draft) => structuredClone(draft));
  }

  async getById(id: string): Promise<EmailDraftRecord | null> {
    const found = getMockStore().drafts.find((d) => d.id === id);
    return found ? structuredClone(found) : null;
  }

  async create(input: CreateEmailDraftInput): Promise<EmailDraftRecord> {
    const store = getMockStore();
    const now = nowIso();
    const id = `mock-draft-${store.drafts.length + 1}`;
    const next: EmailDraftRecord = {
      attachmentName: input.attachmentName,
      body: input.body,
      cc: [...input.cc],
      createdAt: now,
      createdFromPlanId: input.createdFromPlanId,
      draftType: input.draftType,
      id,
      lastError: null,
      sentEmailLogId: null,
      shipmentId: input.shipmentId,
      status: input.status,
      subject: input.subject,
      to: [...input.to],
      updatedAt: now,
    };
    store.drafts.push(next);
    return structuredClone(next);
  }

  async update(id: string, input: UpdateEmailDraftInput): Promise<EmailDraftRecord | null> {
    const store = getMockStore();
    const index = store.drafts.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const current = store.drafts[index]!;
    const next: EmailDraftRecord = {
      ...current,
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.attachmentName !== undefined ? { attachmentName: input.attachmentName } : {}),
      ...(input.to !== undefined ? { to: [...input.to] } : {}),
      ...(input.cc !== undefined ? { cc: [...input.cc] } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: nowIso(),
    };
    store.drafts[index] = next;
    return structuredClone(next);
  }

  async markSent(input: MarkSentInput): Promise<EmailDraftRecord | null> {
    const store = getMockStore();
    const index = store.drafts.findIndex((d) => d.id === input.draftId);
    if (index === -1) return null;

    const current = store.drafts[index]!;
    const next: EmailDraftRecord = {
      ...current,
      lastError: input.lastError,
      sentEmailLogId: input.emailLogId,
      status: "sent",
      updatedAt: nowIso(),
    };
    store.drafts[index] = next;
    return structuredClone(next);
  }
}
