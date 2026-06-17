export type EmailMessageSyncStatus =
  | "confirmed"
  | "failed"
  | "ignored"
  | "new"
  | "parsed"
  | "queued";

export type EmailMessageRecord = {
  attachments: string[];
  bodySummary: string;
  bodyText: string;
  cc: string[];
  createdAt: string;
  from: string;
  id: string;
  mailbox: string;
  messageId: string;
  receivedAt: string;
  subject: string;
  syncStatus: EmailMessageSyncStatus;
  threadId: string | null;
  to: string[];
  updatedAt: string;
};

export type CreateEmailMessageInput = Omit<
  EmailMessageRecord,
  "createdAt" | "id" | "updatedAt"
>;

export type UpdateEmailMessageSyncInput = {
  id: string;
  syncStatus: EmailMessageSyncStatus;
};

export interface EmailMessageRepository {
  create(input: CreateEmailMessageInput): Promise<EmailMessageRecord>;
  getById(id: string): Promise<EmailMessageRecord | null>;
  getByMessageId(messageId: string): Promise<EmailMessageRecord | null>;
  list(): Promise<EmailMessageRecord[]>;
  updateSyncStatus(input: UpdateEmailMessageSyncInput): Promise<EmailMessageRecord | null>;
}
