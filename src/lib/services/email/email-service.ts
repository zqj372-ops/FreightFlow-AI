import { ActionSource, EmailRecipientType, Prisma, ShipmentActionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { applyShipmentAction } from "@/lib/freightflow-domain";
import {
  shipmentInclude,
  shipmentUpdateData,
  toShipmentRecord,
} from "@/lib/freightflow-data";

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
  draftId?: unknown;
  to?: unknown;
  cc?: unknown;
  recipients?: unknown;
};

type SendShipmentEmailOptions = {
  persistEmailLog?: boolean;
};

type PersistBookingEmailSendOptions = {
  draftId?: string | null;
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

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

async function markMatchingDraftSent(
  tx: Prisma.TransactionClient,
  input: SendEmailInput,
  draftId?: string | null,
) {
  const select = { id: true, status: true } as const;
  const explicitDraft = draftId
    ? await tx.bookingEmailDraft.findFirst({
        where: {
          id: draftId,
          shipmentId: input.shipmentId,
        },
        select,
      })
    : null;
  const matchingDraft =
    explicitDraft ??
    (await tx.bookingEmailDraft.findFirst({
      where: {
        shipmentId: input.shipmentId,
        status: { in: ["DRAFT", "APPROVED", "FAILED"] },
        OR: [
          { subject: input.subject, body: input.body },
          { subject: input.subject },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select,
    }));

  if (!matchingDraft) return null;

  return tx.bookingEmailDraft.update({
    where: { id: matchingDraft.id },
    data: { status: "SENT" },
    select,
  });
}

export async function markBookingDraftFailed({
  draftId,
  shipmentId,
  subject,
}: {
  draftId?: string | null;
  shipmentId: string;
  subject?: string;
}) {
  const matchingDraft = draftId
    ? await prisma.bookingEmailDraft.findFirst({
        where: { id: draftId, shipmentId },
        select: { id: true },
      })
    : subject
      ? await prisma.bookingEmailDraft.findFirst({
          where: {
            shipmentId,
            subject,
            status: { in: ["DRAFT", "APPROVED"] },
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      : null;

  if (!matchingDraft) return null;

  return prisma.bookingEmailDraft.update({
    where: { id: matchingDraft.id },
    data: { status: "FAILED" },
    select: { id: true, status: true },
  });
}

export async function persistBookingEmailSend(
  input: SendEmailInput,
  sentAt: Date,
  options: PersistBookingEmailSendOptions = {},
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.shipment.findUnique({
      where: { id: input.shipmentId },
      include: shipmentInclude,
    });

    if (!before) throw new Error("Shipment not found.");

    const beforeRecord = toShipmentRecord(before);
    const to = input.recipients.filter((recipient) => recipient.type === "to").map((recipient) => recipient.email);
    const cc = input.recipients.filter((recipient) => recipient.type === "cc").map((recipient) => recipient.email);
    const { record: afterRecord, summary } = applyShipmentAction(beforeRecord, {
      action: "订舱邮件",
      body: input.body,
      cc,
      source: "SYSTEM",
      subject: input.subject,
      to,
    }, sentAt);

    const after = await tx.shipment.update({
      where: { id: input.shipmentId },
      data: shipmentUpdateData(afterRecord),
      include: shipmentInclude,
    });
    const draft = await markMatchingDraftSent(tx, input, options.draftId);
    const emailLog = await tx.shipmentEmailLog.create({
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
      include: { recipients: true },
    });
    const actionLog = await tx.shipmentActionLog.create({
      data: {
        shipmentId: input.shipmentId,
        actionType: ShipmentActionType.BOOKING_EMAIL,
        source: ActionSource.SYSTEM,
        summary,
        beforeSnapshot: jsonValue(beforeRecord),
        afterSnapshot: jsonValue(afterRecord),
      },
    });

    return {
      actionLog,
      draft,
      emailLog: mapEmailLog(emailLog),
      shipment: toShipmentRecord(after),
    };
  });
}

export async function sendShipmentEmail(
  input: SendEmailInput,
  options: SendShipmentEmailOptions = {},
): Promise<SendShipmentEmailResult> {
  const provider = await createEmailProvider();
  const providerMessage = await provider.send(input);
  let emailLog: PersistedEmailLog | null = null;
  let persistenceWarning: string | undefined;

  if (options.persistEmailLog !== false) {
    try {
      emailLog = await saveShipmentEmailLog(input, providerMessage.sentAt);
    } catch (error) {
      persistenceWarning =
        error instanceof Error
          ? `Email was sent, but ShipmentEmailLog was not persisted: ${error.message}`
          : "Email was sent, but ShipmentEmailLog was not persisted.";
    }
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
