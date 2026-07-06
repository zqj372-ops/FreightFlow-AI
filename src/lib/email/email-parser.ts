import type { EmailAttachment } from "./attachment-detector";

export type ParsedEmailMessage = {
  attachments: EmailAttachment[];
  body: string;
  from: string;
  receivedAt: string;
  subject: string;
};

export type RawEmailMessage = Partial<ParsedEmailMessage> & {
  date?: string;
  text?: string;
};

export function parseEmailMessage(raw: RawEmailMessage): ParsedEmailMessage {
  return {
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    body: raw.body?.trim() || raw.text?.trim() || "",
    from: raw.from?.trim() || "",
    receivedAt: raw.receivedAt || raw.date || new Date().toISOString(),
    subject: raw.subject?.trim() || "",
  };
}

export function parseEmailMessages(rawMessages: RawEmailMessage[]) {
  return rawMessages.map(parseEmailMessage);
}
