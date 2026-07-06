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
  emailLog: PersistedEmailLog | null;
  mode: "mock" | "provider";
  providerMessage: EmailProviderMessage;
  persistenceWarning?: string;
};
