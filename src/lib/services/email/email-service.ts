import { EmailMessageSyncStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { readEmailConfig, type EmailConfig } from "@/lib/email-config";

import { ImapPullProvider } from "./imap-pull-provider";
import { MockEmailPullProvider } from "./mock-pull-provider";
import { createEmailProvider } from "./mock-provider";
import type {
  EmailMessageFull,
  EmailMessageMetadata,
  EmailPullProvider,
  RunSyncOptions,
  SyncReport,
  SyncReportError,
} from "./types";
import { EmailRecipientType } from "@prisma/client";
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
  const emailLog = await saveShipmentEmailLog(input, providerMessage.sentAt);

  return {
    mode: provider.name === "mock-local" ? "mock" : "provider",
    providerMessage,
    emailLog,
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

/* -------------------------------------------------------------------------- */
/*  Pull sync (IMAP / mock-pull)                                              */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIMIT = 50;
const FAILED_ERROR_COLUMN_NOTE = "DB column missing - TODO";

export type TriggerRecognition = (emailMessageId: string) => Promise<void>;

/**
 * Default recognition trigger — marks the email as PARSED so the next stage
 * (recognition queue / human review) can pick it up.  Track M3 will replace
 * this with a real classifier that also creates an EmailRecognitionResult row.
 */
export const defaultTriggerRecognition: TriggerRecognition = async (emailMessageId) => {
  await prisma.emailMessage.update({
    where: { id: emailMessageId },
    data: { syncStatus: EmailMessageSyncStatus.PARSED },
  });
};

type PullFactoryOptions = {
  provider?: EmailPullProvider;
};

/**
 * Pick the right pull provider based on the merged email config.
 * IMAP is selected when a usable IMAP host is present.  A failure to
 * connect to a real IMAP server surfaces as a thrown error from the
 * provider itself — callers must NOT silently fall back to mock.
 */
export async function createPullProvider(options: PullFactoryOptions = {}): Promise<EmailPullProvider> {
  if (options.provider) return options.provider;

  const config = await readEmailConfig();
  if (hasImapConfig(config)) {
    return new ImapPullProvider({ config });
  }

  return new MockEmailPullProvider();
}

function hasImapConfig(config: EmailConfig): boolean {
  return Boolean(config.imapHost && config.username && config.password);
}

type InMemoryFailure = {
  errorMessage: string;
  messageId: string;
};

const inMemoryFailures: InMemoryFailure[] = [];

export function drainInMemorySyncFailures(): InMemoryFailure[] {
  const copy = inMemoryFailures.splice(0, inMemoryFailures.length);
  return copy;
}

export function recordInMemorySyncFailure(failure: InMemoryFailure) {
  inMemoryFailures.push(failure);
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function buildError(
  stage: SyncReportError["stage"],
  code: SyncReportError["code"],
  message: string,
  messageId?: string,
): SyncReportError {
  return {
    code,
    message,
    messageId,
    stage,
  };
}

async function findLastSyncedAt(mailbox: string): Promise<Date | null> {
  const latest = await prisma.emailMessage.findFirst({
    orderBy: { receivedAt: "desc" },
    where: { mailbox },
    select: { receivedAt: true },
  });
  return latest?.receivedAt ?? null;
}

export type RunSyncDeps = {
  provider?: EmailPullProvider;
  triggerRecognition?: TriggerRecognition;
};

/**
 * Pull new mail, persist it as EmailMessage rows, and trigger the downstream
 * recognition hook.  Returns a SyncReport describing the run.
 *
 * - Provider choice: real IMAP if `email-config.json` (or `IMAP_HOST` env) is
 *   configured; otherwise the in-process mock provider.  IMAP transport errors
 *   bubble up so the route can return a clear 5xx response.
 * - Dedup is by `messageId` (case-insensitive on the lookup side).
 * - Per-message failures (fetch, persist, recognition) are captured in
 *   `errors[]` and do not abort the run.
 */
export async function runSync(
  options: RunSyncOptions = {},
  deps: RunSyncDeps = {},
): Promise<SyncReport> {
  const startedAt = new Date();
  const mailbox = options.mailbox ?? "INBOX";
  const limit = options.limit ?? DEFAULT_LIMIT;
  const trigger = deps.triggerRecognition ?? defaultTriggerRecognition;

  const report: SyncReport = {
    duplicatesSkipped: 0,
    errorCount: 0,
    errors: [],
    fetched: 0,
    finishedAt: startedAt.toISOString(),
    newInserted: 0,
    provider: "unknown",
    scanned: 0,
    startedAt: startedAt.toISOString(),
  };

  let provider: EmailPullProvider;
  try {
    provider = deps.provider ?? (await createPullProvider());
    report.provider = provider.name;
  } catch (error) {
    report.errorCount += 1;
    report.errors.push(
      buildError("search", "PROVIDER", error instanceof Error ? error.message : String(error)),
    );
    report.finishedAt = new Date().toISOString();
    return report;
  }

  const since = options.fullSync ? null : await findLastSyncedAt(mailbox);

  let metadata: EmailMessageMetadata[];
  try {
    metadata = await provider.search({ limit, mailbox, since });
    report.scanned = metadata.length;
  } catch (error) {
    report.errorCount += 1;
    report.errors.push(
      buildError(
        "search",
        "PROVIDER",
        error instanceof Error ? error.message : String(error),
      ),
    );
    report.finishedAt = new Date().toISOString();
    return report;
  }

  for (const entry of metadata) {
    let full: EmailMessageFull;
    try {
      full = await provider.fetchFull(entry);
    } catch (error) {
      report.errorCount += 1;
      report.errors.push(
        buildError(
          "fetch",
          "FETCH",
          error instanceof Error ? error.message : String(error),
          entry.messageId,
        ),
      );
      continue;
    }
    report.fetched += 1;

    try {
      const existing = await prisma.emailMessage.findUnique({
        where: { messageId: full.messageId },
        select: { id: true },
      });
      if (existing) {
        report.duplicatesSkipped += 1;
        continue;
      }
    } catch (error) {
      report.errorCount += 1;
      report.errors.push(
        buildError(
          "persist",
          "INSERT",
          error instanceof Error ? error.message : String(error),
          full.messageId,
        ),
      );
      recordInMemorySyncFailure({
        errorMessage: FAILED_ERROR_COLUMN_NOTE,
        messageId: full.messageId,
      });
      continue;
    }

    let created: { id: string };
    try {
      created = await prisma.emailMessage.create({
        data: {
          attachments: full.attachments ?? [],
          bodySummary: "",
          bodyText: full.bodyText ?? "",
          cc: full.cc ?? [],
          from: full.from ?? "",
          mailbox: full.mailbox,
          messageId: full.messageId,
          receivedAt: full.receivedAt,
          subject: full.subject ?? "",
          syncStatus: EmailMessageSyncStatus.NEW,
          threadId: full.threadId,
          to: full.to ?? [],
        },
        select: { id: true },
      });
      report.newInserted += 1;
    } catch (error) {
      // Most likely a unique-constraint race (another run inserted the same
      // messageId).  Treat as duplicate and keep going.
      const message = error instanceof Error ? error.message : String(error);
      const isDuplicate = /unique|duplicate/i.test(message);
      if (isDuplicate) {
        report.duplicatesSkipped += 1;
        continue;
      }
      report.errorCount += 1;
      report.errors.push(
        buildError("persist", "INSERT", message, full.messageId),
      );
      // Persist FAILED intent: the schema has a syncStatus enum but no
      // dedicated errorMessage column, so we record the failure in memory and
      // note the gap here.
      try {
        await prisma.emailMessage.create({
          data: {
            attachments: [],
            bodySummary: "",
            bodyText: full.bodyText ?? "",
            cc: full.cc ?? [],
            from: full.from ?? "",
            mailbox: full.mailbox,
            messageId: `${full.messageId}#failed-${Date.now()}`,
            receivedAt: full.receivedAt,
            subject: full.subject ?? "",
            syncStatus: EmailMessageSyncStatus.FAILED,
            threadId: full.threadId,
            to: full.to ?? [],
          },
          select: { id: true },
        });
      } catch {
        // swallow: best-effort shadow row
      }
      recordInMemorySyncFailure({
        errorMessage: FAILED_ERROR_COLUMN_NOTE,
        messageId: full.messageId,
      });
      continue;
    }

    try {
      await trigger(created.id);
    } catch (error) {
      report.errorCount += 1;
      report.errors.push(
        buildError(
          "recognize",
          "RECOGNITION",
          error instanceof Error ? error.message : String(error),
          full.messageId,
        ),
      );
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

export { asStringArray as emailRecipientsToStringArray };
