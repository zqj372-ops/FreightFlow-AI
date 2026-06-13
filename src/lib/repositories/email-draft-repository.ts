import type { EmailDraftStatus, EmailDraftType } from "./types";

export type EmailDraftRecord = {
  attachmentName: string | null;
  body: string;
  cc: string[];
  createdAt: string;
  createdFromPlanId: string | null;
  draftType: EmailDraftType;
  id: string;
  lastError: string | null;
  sentEmailLogId: string | null;
  shipmentId: string;
  status: EmailDraftStatus;
  subject: string;
  to: string[];
  updatedAt: string;
};

export type CreateEmailDraftInput = {
  attachmentName: string | null;
  body: string;
  cc: string[];
  createdFromPlanId: string | null;
  draftType: EmailDraftType;
  shipmentId: string;
  status: EmailDraftStatus;
  subject: string;
  to: string[];
};

export type UpdateEmailDraftInput = Partial<{
  attachmentName: string | null;
  body: string;
  cc: string[];
  status: EmailDraftStatus;
  subject: string;
  to: string[];
}>;

export type MarkSentInput = {
  draftId: string;
  emailLogId: string;
  lastError: string | null;
};

export interface EmailDraftRepository {
  create(input: CreateEmailDraftInput): Promise<EmailDraftRecord>;
  getById(id: string): Promise<EmailDraftRecord | null>;
  list(): Promise<EmailDraftRecord[]>;
  markSent(input: MarkSentInput): Promise<EmailDraftRecord | null>;
  update(id: string, input: UpdateEmailDraftInput): Promise<EmailDraftRecord | null>;
}
