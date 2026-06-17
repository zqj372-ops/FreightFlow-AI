import type {
  EmailMessageFull,
  EmailMessageMetadata,
  EmailPullProvider,
  EmailSearchOptions,
} from "./types";

type MockMailboxEntry = {
  bodyText: string;
  mailbox: string;
  messageId: string;
  subject: string;
  from: string;
  to?: string[];
  cc?: string[];
  threadId?: string;
  receivedAt: Date;
};

const fixtureByMailbox: Record<string, MockMailboxEntry[]> = {
  INBOX: [
    {
      bodyText: "您好，SO已出，附件请查收。SO: OOLU8791320。",
      from: "seabay.logistics@freightflow.ai",
      mailbox: "INBOX",
      messageId: "mock-so-released-001",
      receivedAt: new Date("2026-06-13T08:00:00.000Z"),
      subject: "FF-CA-240610-A01 SO已出",
      threadId: "thread-so-001",
    },
    {
      bodyText: "Dear team, SI Confirmed for COSU5519028. Documents are confirmed.",
      cc: ["ops@freightflow.ai"],
      from: "apex.forwarding@freightflow.ai",
      mailbox: "INBOX",
      messageId: "mock-si-confirmed-002",
      receivedAt: new Date("2026-06-13T08:15:00.000Z"),
      subject: "FF-US-240610-B03 SI Confirmed",
      threadId: "thread-si-002",
    },
    {
      bodyText: "代理反馈柜型不符，请确认是否由 40HQ 改为 40GP。",
      from: "blue.anchor@freightflow.ai",
      mailbox: "INBOX",
      messageId: "mock-exception-003",
      receivedAt: new Date("2026-06-13T08:30:00.000Z"),
      subject: "FF-CA-240610-E15 柜型不符，请修改资料",
      threadId: "thread-exception-003",
    },
  ],
};

function getEntries(mailbox: string): MockMailboxEntry[] {
  return fixtureByMailbox[mailbox] ?? [];
}

export class MockEmailPullProvider implements EmailPullProvider {
  name = "mock-pull";

  async search(options: EmailSearchOptions): Promise<EmailMessageMetadata[]> {
    const mailbox = options.mailbox ?? "INBOX";
    const since = options.since ?? null;
    const limit = options.limit ?? 100;

    return getEntries(mailbox)
      .filter((entry) => (since ? entry.receivedAt > since : true))
      .slice(0, limit)
      .map((entry) => ({
        attachments: [],
        cc: entry.cc ?? [],
        from: entry.from,
        mailbox: entry.mailbox,
        messageId: entry.messageId,
        receivedAt: entry.receivedAt,
        subject: entry.subject,
        threadId: entry.threadId ?? null,
        to: entry.to ?? [],
      }));
  }

  async fetchFull(metadata: EmailMessageMetadata): Promise<EmailMessageFull> {
    const entry = getEntries(metadata.mailbox).find((item) => item.messageId === metadata.messageId);

    if (!entry) {
      throw new Error(`mock-pull: message ${metadata.messageId} not found in ${metadata.mailbox}`);
    }

    return {
      ...metadata,
      bodyText: entry.bodyText,
      provider: this.name,
    };
  }
}
