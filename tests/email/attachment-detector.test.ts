import { describe, expect, it } from "vitest";

import { findSoAttachments, isLikelySoAttachment } from "@/lib/email/attachment-detector";

describe("SO attachment detector", () => {
  it("keeps likely SO files and ignores unrelated attachments", () => {
    expect(isLikelySoAttachment({ fileName: "SO_OOLU8791320.pdf", contentType: "application/pdf" })).toBe(true);
    expect(isLikelySoAttachment({ fileName: "invoice.xlsx", contentType: "application/vnd.ms-excel" })).toBe(false);

    expect(
      findSoAttachments([
        { fileName: "booking-confirmation.pdf", contentType: "application/pdf" },
        { fileName: "packing-list.pdf", contentType: "application/pdf" },
      ]),
    ).toHaveLength(1);
  });
});
