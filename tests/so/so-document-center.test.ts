import { describe, expect, it } from "vitest";

import { buildMockSoDocumentCenterRecords, getSoDocumentBucket } from "@/lib/so/so-document-center";

describe("SO document center helpers", () => {
  it("maps stored OCR states to recognition center buckets", () => {
    expect(getSoDocumentBucket({ ocrStatus: "PENDING" })).toMatchObject({
      statusBucket: "pending",
      statusLabel: "待识别",
    });
    expect(getSoDocumentBucket({ ocrStatus: "NEED_REVIEW" })).toMatchObject({
      statusBucket: "review",
      statusLabel: "待复核",
    });
    expect(getSoDocumentBucket({ extractedJson: { appliedAt: "2026-06-10T08:00:00.000Z" }, ocrStatus: "EXTRACTED" })).toMatchObject({
      statusBucket: "applied",
      statusLabel: "已回写",
    });
    expect(getSoDocumentBucket({ extractedJson: { error: "OCR failed" }, ocrStatus: "FAILED" })).toMatchObject({
      statusBucket: "failed",
      statusLabel: "失败",
    });
  });

  it("provides mock records for all SO recognition center statuses", () => {
    const buckets = new Set(buildMockSoDocumentCenterRecords().map((record) => record.statusBucket));

    expect(buckets).toEqual(new Set(["pending", "review", "applied", "failed"]));
  });
});
