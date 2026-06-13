import { ImapFlow } from "imapflow";

import type { EmailConfig } from "@/lib/email-config";

import type {
  EmailMessageFull,
  EmailMessageMetadata,
  EmailPullProvider,
  EmailSearchOptions,
} from "./types";

function formatAddressList(value: { address?: string; name?: string }[] | undefined): string[] {
  if (!value) return [];
  return value
    .map((entry) => entry.address?.trim())
    .filter((address): address is string => Boolean(address));
}

function pickMessageId(envelope: { messageId?: string; inReplyTo?: string } | undefined): string {
  if (!envelope) return "";
  return envelope.messageId?.trim() || envelope.inReplyTo?.trim() || "";
}

function toDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function getTextBody(source: Buffer | undefined): string {
  if (!source) return "";
  // We do not attempt a full MIME parse here; the bodyText field is intentionally
  // raw so downstream recognition rules can still inspect it.  Stripping
  // transfer-encoding noise is out of scope for the first cut.
  return source.toString("utf8");
}

export type ImapPullProviderOptions = {
  config: EmailConfig;
  /** Allow callers to inject a custom client (e.g. a stub for tests). */
  factory?: (config: EmailConfig) => ImapFlow;
};

export class ImapPullProvider implements EmailPullProvider {
  name = "imap";

  private readonly config: EmailConfig;
  private readonly factory: (config: EmailConfig) => ImapFlow;

  constructor(options: ImapPullProviderOptions) {
    this.config = options.config;
    this.factory = options.factory ?? defaultImapFactory;
  }

  async search(options: EmailSearchOptions): Promise<EmailMessageMetadata[]> {
    const client = this.factory(this.config);
    const mailbox = options.mailbox ?? "INBOX";
    const limit = options.limit ?? 50;

    try {
      await client.connect();
      const lock = await client.getMailboxLock(mailbox);
      try {
        const query: Record<string, unknown> = {};
        if (options.since) {
          query.since = options.since;
        }

        const uids = (await client.search(query, { uid: true })) || [];
        const sliced = uids.slice(-limit);

        if (sliced.length === 0) return [];

        const fetched: EmailMessageMetadata[] = [];
        for await (const message of client.fetch(
          sliced,
          { envelope: true, internalDate: true, uid: true },
          { uid: true },
        )) {
          const envelope = message.envelope;
          const messageId = pickMessageId(envelope) || `${mailbox}-${message.uid}`;
          fetched.push({
            attachments: [],
            cc: formatAddressList(envelope?.cc),
            from: formatAddressList(envelope?.from)[0] ?? "",
            mailbox,
            messageId,
            receivedAt: (toDate(envelope?.date) ?? message.internalDate ?? new Date()) as Date,
            subject: envelope?.subject ?? "(无主题)",
            threadId: envelope?.inReplyTo?.trim() || null,
            to: formatAddressList(envelope?.to),
          });
        }

        // IMAP returns newest first; the caller expects insertion order to be oldest → newest.
        return fetched.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  async fetchFull(metadata: EmailMessageMetadata): Promise<EmailMessageFull> {
    const client = this.factory(this.config);

    try {
      await client.connect();
      const lock = await client.getMailboxLock(metadata.mailbox);
      try {
        // Look up the message UID again — search already returned metadata, but
        // re-query keeps the implementation simple and robust.
        const uids = (await client.search(
          { header: { "message-id": metadata.messageId } },
          { uid: true },
        )) || [];

        if (uids.length === 0) {
          throw new Error(`imap: message ${metadata.messageId} not found in ${metadata.mailbox}`);
        }

        for await (const message of client.fetch(
          uids,
          { envelope: true, source: true, uid: true },
          { uid: true },
        )) {
          return {
            ...metadata,
            bodyText: getTextBody(message.source),
            provider: this.name,
          };
        }

        throw new Error(`imap: failed to fetch body for ${metadata.messageId}`);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}

function defaultImapFactory(config: EmailConfig): ImapFlow {
  return new ImapFlow({
    auth: {
      pass: config.password,
      user: config.username,
    },
    host: config.imapHost,
    logger: false,
    port: config.imapPort,
    secure: config.imapSecure,
  });
}
