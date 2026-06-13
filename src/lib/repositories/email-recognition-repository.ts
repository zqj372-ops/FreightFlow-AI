import type { EmailRecognitionStatus, EmailRecognitionType } from "./types";

export type EmailRecognitionRecord = {
  confidence: number;
  createdAt: string;
  emailMessageId: string;
  extractedFields: Record<string, string>;
  id: string;
  matchedShipmentId: string | null;
  recognitionType: EmailRecognitionType;
  reviewedAt: string | null;
  reviewedBy: string | null;
  riskFlags: string[];
  status: EmailRecognitionStatus;
  summary: string;
  updatedAt: string;
};

export type CreateEmailRecognitionInput = Omit<
  EmailRecognitionRecord,
  "createdAt" | "id" | "reviewedAt" | "reviewedBy" | "updatedAt"
>;

export type UpdateEmailRecognitionStatusInput = {
  id: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  status: EmailRecognitionStatus;
};

export type RecognitionWithEmail = EmailRecognitionRecord & {
  emailMessage: {
    bodyText: string;
    from: string;
    id: string;
    messageId: string;
    receivedAt: string;
    subject: string;
  };
};

export interface EmailRecognitionRepository {
  create(input: CreateEmailRecognitionInput): Promise<EmailRecognitionRecord>;
  getById(id: string): Promise<RecognitionWithEmail | null>;
  listPending(): Promise<RecognitionWithEmail[]>;
  updateStatus(input: UpdateEmailRecognitionStatusInput): Promise<EmailRecognitionRecord | null>;
}
