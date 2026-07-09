import type { EmailAttachment } from "./attachment-detector";

export type ParsedEmailMessage = {
  attachments: EmailAttachment[];
  body: string;
  cc?: string[];
  from: string;
  inReplyTo?: string;
  messageId?: string;
  receivedAt: string;
  references?: string[];
  subject: string;
  threadId?: string;
  to?: string[];
};

export type RawEmailMessage = Omit<Partial<ParsedEmailMessage>, "cc" | "references" | "to"> & {
  cc?: string[] | string;
  date?: string;
  messageID?: string;
  references?: string[] | string;
  text?: string;
  to?: string[] | string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAddressList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }

  const single = normalizeString(value);
  return single
    ? single
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeReferenceList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }

  const single = normalizeString(value);
  return single ? single.split(/\s+/).map((item) => item.trim()).filter(Boolean) : [];
}

export function parseEmailMessage(raw: RawEmailMessage): ParsedEmailMessage {
  const messageId = normalizeString(raw.messageId) || normalizeString(raw.messageID);
  const inReplyTo = normalizeString(raw.inReplyTo);
  const references = normalizeReferenceList(raw.references);
  const threadId = normalizeString(raw.threadId) || inReplyTo || references.at(-1) || undefined;

  return {
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    body: raw.body?.trim() || raw.text?.trim() || "",
    cc: normalizeAddressList(raw.cc),
    from: raw.from?.trim() || "",
    inReplyTo: inReplyTo || undefined,
    messageId: messageId || undefined,
    receivedAt: raw.receivedAt || raw.date || new Date().toISOString(),
    references,
    subject: raw.subject?.trim() || "",
    threadId,
    to: normalizeAddressList(raw.to),
  };
}

export function parseEmailMessages(rawMessages: RawEmailMessage[]) {
  return rawMessages.map(parseEmailMessage);
}
