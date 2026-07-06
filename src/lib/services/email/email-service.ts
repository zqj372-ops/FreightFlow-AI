import { EmailRecipientType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { createEmailProvider } from "./mock-provider";
import type {
  EmailRecipientInput,
  EmailRecipientKind,
  PersistedEmailLog,
  SendEmailInput,
  SendShipmentEmailResult,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawSendEmailInput = {
  subject?: unknown;
  body?: unknown;
  attachmentName?: unknown;
  to?: unknown;
  cc?: unknown;
  recipients?: unknown;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[;,]+$/, "").toLowerCase() : "";
}

function normalizeRecipientList(value: unknown, type: EmailRecipientKind): EmailRecipientInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeEmail(item))
    .filter(Boolean)
    .map((email) => ({ email, type }));
}

function normalizeExplicitRecipients(value: unknown): EmailRecipientInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const candidate = item as { email?: unknown; type?: unknown; recipientType?: unknown };
      const email = normalizeEmail(candidate.email);
      const rawType = candidate.type ?? candidate.recipientType;
      const type = rawType === "cc" || rawType === "CC" ? "cc" : "to";

      return email ? { email, type } : null;
    })
    .filter((recipient): recipient is EmailRecipientInput => recipient !== null);
}

function dedupeRecipients(recipients: EmailRecipientInput[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = `${recipient.type}:${recipient.email}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toPrismaRecipientType(type: EmailRecipientKind) {
  return type === "cc" ? EmailRecipientType.CC : EmailRecipientType.TO;
}

function fromPrismaRecipientType(type: EmailRecipientType): EmailRecipientKind {
  return type === EmailRecipientType.CC ? "cc" : "to";
}

function mapEmailLog(log: {
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
    recipientType: EmailRecipientType;
    createdAt: Date;
  }>;
}): PersistedEmailLog {
  return {
    ...log,
    recipients: log.recipients.map((recipient) => ({
      ...recipient,
      recipientType: fromPrismaRecipientType(recipient.recipientType),
    })),
  };
}

export function parseShipmentEmailInput(shipmentId: string, raw: RawSendEmailInput): SendEmailInput {
  const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const attachmentName = typeof raw.attachmentName === "string" && raw.attachmentName.trim() ? raw.attachmentName.trim() : null;
  const recipients = dedupeRecipients([
    ...normalizeRecipientList(raw.to, "to"),
    ...normalizeRecipientList(raw.cc, "cc"),
    ...normalizeExplicitRecipients(raw.recipients),
  ]);

  if (!shipmentId) throw new Error("Missing shipmentId");
  if (!subject) throw new Error("Missing subject");
  if (!body) throw new Error("Missing body");
  if (!recipients.some((recipient) => recipient.type === "to")) throw new Error("At least one to recipient is required");

  const invalidRecipient = recipients.find((recipient) => !EMAIL_PATTERN.test(recipient.email));
  if (invalidRecipient) throw new Error(`Invalid email: ${invalidRecipient.email}`);

  return {
    shipmentId,
    subject,
    body,
    attachmentName,
    recipients,
  };
}

export async function saveShipmentEmailLog(input: SendEmailInput, sentAt: Date | null) {
  const emailLog = await prisma.shipmentEmailLog.create({
    data: {
      shipmentId: input.shipmentId,
      subject: input.subject,
      body: input.body,
      attachmentName: input.attachmentName ?? null,
      sentAt,
      recipients: {
        create: input.recipients.map((recipient) => ({
          email: recipient.email,
          recipientType: toPrismaRecipientType(recipient.type),
        })),
      },
    },
    include: {
      recipients: true,
    },
  });

  return mapEmailLog(emailLog);
}

export async function sendShipmentEmail(input: SendEmailInput): Promise<SendShipmentEmailResult> {
  const provider = await createEmailProvider();
  const providerMessage = await provider.send(input);
  let emailLog: PersistedEmailLog | null = null;
  let persistenceWarning: string | undefined;

  try {
    emailLog = await saveShipmentEmailLog(input, providerMessage.sentAt);
  } catch (error) {
    persistenceWarning =
      error instanceof Error
        ? `Email was sent, but ShipmentEmailLog was not persisted: ${error.message}`
        : "Email was sent, but ShipmentEmailLog was not persisted.";
  }

  return {
    mode: provider.name === "mock-local" ? "mock" : "provider",
    providerMessage,
    emailLog,
    persistenceWarning,
  };
}

export async function listShipmentEmailLogs(shipmentId: string) {
  const logs = await prisma.shipmentEmailLog.findMany({
    where: { shipmentId },
    include: { recipients: true },
    orderBy: { createdAt: "desc" },
  });

  return logs.map(mapEmailLog);
}
