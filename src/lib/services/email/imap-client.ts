import { ImapFlow } from "imapflow";

import type { EmailConfig } from "@/lib/email-config";

export async function verifyImapConnection(config: EmailConfig) {
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
    await client.mailboxOpen("INBOX", { readOnly: true });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
