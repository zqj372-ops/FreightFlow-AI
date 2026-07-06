import { ImapFlow } from "imapflow";
import type { MessageStructureObject } from "imapflow";

import type { EmailConfig } from "@/lib/email-config";

import type { EmailAttachment } from "./attachment-detector";
import type { RawEmailMessage } from "./email-parser";

function firstAddress(addresses: Array<{ address?: string | false | null }> | undefined) {
  return addresses?.map((item) => item.address).filter(Boolean).join(", ") ?? "";
}

function filenameFromNode(node: MessageStructureObject) {
  const dispositionFilename = node.dispositionParameters?.filename;
  const contentName = node.parameters?.name;

  return typeof dispositionFilename === "string"
    ? dispositionFilename
    : typeof contentName === "string"
      ? contentName
      : "";
}

export function extractEmailAttachmentsFromStructure(structure: MessageStructureObject | undefined): EmailAttachment[] {
  if (!structure) return [];

  const attachments: EmailAttachment[] = [];
  const visit = (node: MessageStructureObject) => {
    const fileName = filenameFromNode(node).trim();
    const disposition = node.disposition?.toLowerCase() ?? "";

    if (fileName && (disposition === "attachment" || !node.type.startsWith("text/"))) {
      attachments.push({
        contentType: node.type,
        fileName,
        size: node.size ?? null,
      });
    }

    for (const child of node.childNodes ?? []) {
      visit(child);
    }
  };

  visit(structure);

  return attachments;
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export function extractPlainTextFromSource(source: Buffer | undefined) {
  if (!source) return "";

  const raw = source.toString("utf8");
  const [, ...bodyParts] = raw.split(/\r?\n\r?\n/);
  const body = bodyParts.join("\n\n");

  return decodeQuotedPrintable(body)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

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

    for await (const message of client.fetch(`${start}:*`, {
      bodyStructure: true,
      envelope: true,
      source: { maxLength: 262144 },
    })) {
      const subject = message.envelope?.subject ?? "";
      const from = firstAddress(message.envelope?.from);

      messages.push({
        attachments: extractEmailAttachmentsFromStructure(message.bodyStructure),
        body: extractPlainTextFromSource(message.source),
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
