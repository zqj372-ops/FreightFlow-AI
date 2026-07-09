import { describe, expect, it } from "vitest";

import { parseEmailMessage } from "@/lib/email/email-parser";

describe("parseEmailMessage", () => {
  it("normalizes IMAP thread fields and recipient lists", () => {
    const message = parseEmailMessage({
      body: "SO attached",
      cc: "ops@example.com; docs@example.com",
      from: "agent@example.com",
      inReplyTo: "<sent-1@example.com>",
      messageID: "<reply-1@example.com>",
      receivedAt: "2026-06-10T12:00:00.000Z",
      references: "<sent-0@example.com> <sent-1@example.com>",
      subject: "Re: booking",
      to: ["booking@example.com", "team@example.com"],
    });

    expect(message.messageId).toBe("<reply-1@example.com>");
    expect(message.inReplyTo).toBe("<sent-1@example.com>");
    expect(message.references).toEqual(["<sent-0@example.com>", "<sent-1@example.com>"]);
    expect(message.threadId).toBe("<sent-1@example.com>");
    expect(message.to).toEqual(["booking@example.com", "team@example.com"]);
    expect(message.cc).toEqual(["ops@example.com", "docs@example.com"]);
  });
});
