export type EmailRecipientKind = "to" | "cc";

export type EmailRecipientInput = {
  email: string;
  type: EmailRecipientKind;
};

export type SendEmailInput = {
  shipmentId: string;
  subject: string;
  body: string;
  attachmentName?: string | null;
  recipients: EmailRecipientInput[];
};

export type EmailProviderMessage = {
  provider: string;
  providerMessageId: string;
  accepted: string[];
  rejected: string[];
  sentAt: Date;
};

export type EmailProvider = {
  name: string;
  send(input: SendEmailInput): Promise<EmailProviderMessage>;
};

export type PersistedEmailLog = {
  id: string;
  shipmentId: string;
  subject: string;
  body: string;
  attachmentName: string | null;
  sentAt: Date | null;
  createdAt: Date;
  recipients: Array<{
    id: string;
    emailLogId: string;
    email: string;
    recipientType: EmailRecipientKind;
    createdAt: Date;
  }>;
};

export type SendShipmentEmailResult = {
  mode: "mock" | "provider";
  providerMessage: EmailProviderMessage;
  emailLog: PersistedEmailLog;
};

/* -------------------------------------------------------------------------- */
/*  Pull (IMAP sync) types                                                    */
/* -------------------------------------------------------------------------- */

export type EmailMessageMetadata = {
  attachments: string[];
  cc: string[];
  from: string;
  mailbox: string;
  messageId: string;
  receivedAt: Date;
  subject: string;
  threadId: string | null;
  to: string[];
};

export type EmailMessageFull = EmailMessageMetadata & {
  bodyText: string;
  provider: string;
};

export type EmailSearchOptions = {
  limit?: number;
  mailbox?: string;
  since?: Date | null;
};

export type EmailPullProvider = {
  /** Provider identifier surfaced in SyncReport.provider (e.g. "imap", "mock-pull"). */
  name: string;
  /** Lightweight metadata listing for a mailbox; used to drive dedupe + counts. */
  search(options: EmailSearchOptions): Promise<EmailMessageMetadata[]>;
  /** Fetch body + attachments for a single message. Should throw on transport errors. */
  fetchFull(metadata: EmailMessageMetadata): Promise<EmailMessageFull>;
};

export type SyncReportError = {
  code: "FETCH" | "INSERT" | "RECOGNITION" | "PROVIDER";
  message: string;
  messageId?: string;
  stage: "search" | "fetch" | "persist" | "recognize";
};

export type SyncReport = {
  duplicatesSkipped: number;
  errorCount: number;
  errors: SyncReportError[];
  fetched: number;
  finishedAt: string;
  newInserted: number;
  provider: string;
  scanned: number;
  startedAt: string;
};

export type RunSyncOptions = {
  fullSync?: boolean;
  limit?: number;
  mailbox?: string;
};
