import { describe, expect, it } from "vitest";
import type { MessageStructureObject } from "imapflow";

import { extractEmailAttachmentsFromStructure, extractPlainTextFromSource } from "@/lib/email/imap-client";

describe("extractEmailAttachmentsFromStructure", () => {
  it("finds attachment filenames from body structure", () => {
    const structure: MessageStructureObject = {
      childNodes: [
        {
          childNodes: [],
          parameters: { charset: "utf-8" },
          type: "text/plain",
        },
        {
          childNodes: [],
          disposition: "attachment",
          dispositionParameters: { filename: "booking-confirmation.pdf" },
          parameters: { name: "ignored.pdf" },
          size: 1234,
          type: "application/pdf",
        },
      ],
      type: "multipart/mixed",
    };

    expect(extractEmailAttachmentsFromStructure(structure)).toEqual([
      {
        contentType: "application/pdf",
        fileName: "booking-confirmation.pdf",
        size: 1234,
      },
    ]);
  });
});

describe("extractPlainTextFromSource", () => {
  it("extracts a small text body from raw source", () => {
    const source = Buffer.from("Subject: Re: booking\r\n\r\nSO= OOLU8791320 attached=2E", "utf8");

    expect(extractPlainTextFromSource(source)).toContain("SO= OOLU8791320 attached.");
  });
});
