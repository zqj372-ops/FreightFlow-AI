import type { BookingDraft } from "@/features/freightflow/page-helpers";

export type EmailDraftStatus = "draft" | "failed" | "pending_review" | "sent";

export type EmailDraftRecord = BookingDraft & {
  createdAt: string;
  createdFromPlanId: string | null;
  id: string;
  lastError: string | null;
  sentEmailLogId: string | null;
  shipmentId: string;
  status: EmailDraftStatus;
  updatedAt: string;
};

export type CreateEmailDraftInput = {
  attachmentName: string;
  body: string;
  cc: string[];
  createdFromPlanId: string | null;
  draftType: "booking" | "follow_up" | "supplement";
  shipmentId: string;
  status: EmailDraftStatus;
  subject: string;
  to: string[];
};

export type UpdateEmailDraftInput = Partial<{
  attachmentName: string;
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
