import { describe, expect, it } from "vitest";

import {
  createEmailAttachmentStoragePath,
  getEmailMessageDedupeId,
  prepareEmailSyncItems,
} from "@/lib/email/email-sync-service";
import { shipments } from "@/lib/mock-data";

describe("email sync service", () => {
  it("uses provider message id for dedupe when present", () => {
    expect(
      getEmailMessageDedupeId({
        attachments: [],
        body: "",
        from: "agent@example.com",
        messageId: "<Reply-1@Example.com>",
        receivedAt: "2026-06-10T12:00:00.000Z",
        subject: "Re: booking",
      }),
    ).toBe("reply-1@example.com");
  });

  it("generates stable fallback dedupe ids without provider message id", () => {
    const message = {
      attachments: [{ fileName: "SO_OOLU8791320.pdf", contentType: "application/pdf" }],
      body: "Booking confirmation for FF-CA-240610-A01 is attached.",
      from: "agent@example.com",
      receivedAt: "2026-06-10T12:00:00.000Z",
      subject: "Re: FF-CA-240610-A01 booking",
    };

    expect(getEmailMessageDedupeId(message)).toBe(getEmailMessageDedupeId(message));
    expect(getEmailMessageDedupeId(message)).toMatch(/^generated:/);
  });

  it("prepares matched SO attachment items for persistence", () => {
    const [item] = prepareEmailSyncItems({
      messages: [
        {
          attachments: [
            { fileName: "SO_OOLU8791320.pdf", contentType: "application/pdf" },
            { fileName: "invoice.pdf", contentType: "application/pdf" },
          ],
          body: "Booking confirmation for FF-CA-240610-A01 is attached.",
          from: "agent@example.com",
          receivedAt: "2026-06-10T12:00:00.000Z",
          subject: "Re: FF-CA-240610-A01 booking",
        },
      ],
      shipments,
    });

    expect(item.match?.shipment.id).toBe("SHP-240610-001");
    expect(item.soAttachments).toHaveLength(1);
    expect(item.soAttachments[0].fileName).toBe("SO_OOLU8791320.pdf");
  });

  it("encodes attachment names in email storage paths", () => {
    expect(createEmailAttachmentStoragePath("email_1", "SO 001/booking.pdf")).toBe(
      "email://email_1/SO%20001%2Fbooking.pdf",
    );
  });
});
