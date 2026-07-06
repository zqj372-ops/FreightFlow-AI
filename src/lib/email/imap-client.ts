import { ImapFlow } from "imapflow";

import type { EmailConfig } from "@/lib/email-config";

import type { RawEmailMessage } from "./email-parser";

export async function fetchRecentEmailMessages(config: EmailConfig, limit = 20): Promise<RawEmailMessage[]> {
  if (!config.enabled || !config.imapHost || !config.username || !config.password) {
    return [];
  }

  const client = new ImapFlow({
    auth: {
      pass: config.password,
      user: config.username,
    },
    host: config.imapHost,
    logger: false,
    port: config.imapPort,
    secure: config.imapSecure,
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const start = Math.max(1, mailbox.exists - limit + 1);
    const messages: RawEmailMessage[] = [];

    for await (const message of client.fetch(`${start}:*`, { envelope: true })) {
      const subject = message.envelope?.subject ?? "";
      const from = message.envelope?.from?.map((item) => item.address).filter(Boolean).join(", ") ?? "";

      messages.push({
        attachments: [],
        body: "",
        from,
        receivedAt: message.envelope?.date?.toISOString() ?? new Date().toISOString(),
        subject,
      });
    }

    return messages;
  } finally {
    await client.logout().catch(() => undefined);
  }
}
