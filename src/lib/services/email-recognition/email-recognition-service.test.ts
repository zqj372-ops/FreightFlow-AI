import { describe, expect, it } from "vitest";

import { shipments } from "@/lib/mock-data";

import { buildMockEmailRecognitionSync, listMockEmailRecognitionQueue } from "./email-recognition-service";

describe("buildMockEmailRecognitionSync", () => {
  it("deduplicates messages by messageId and creates pending recognition items", () => {
    const sync = buildMockEmailRecognitionSync(
      [
        {
          bodyText: "SO已出，SO: OOLU8791320。",
          from: "agent@example.com",
          messageId: "same-message",
          subject: "FF-CA-240610-A01 SO已出",
        },
        {
          bodyText: "SO已出，SO: OOLU8791320。",
          from: "agent@example.com",
          messageId: "same-message",
          subject: "FF-CA-240610-A01 SO已出",
        },
      ],
      shipments,
    );

    expect(sync.importedCount).toBe(1);
    expect(sync.duplicateCount).toBe(1);
    expect(sync.recognitions).toHaveLength(1);
    expect(sync.recognitions[0]).toMatchObject({
      matchedShipmentId: "SHP-240610-001",
      recognitionType: "SO_RECEIVED",
      status: "pending_review",
    });
  });
});

describe("listMockEmailRecognitionQueue", () => {
  it("returns Chinese and English pending recognition fixtures", () => {
    const queue = listMockEmailRecognitionQueue(shipments);

    expect(queue.length).toBeGreaterThanOrEqual(3);
    expect(queue.map((item) => item.recognitionType)).toContain("SO_RECEIVED");
    expect(queue.map((item) => item.recognitionType)).toContain("SUPPLEMENT_CONFIRMED");
    expect(queue.every((item) => item.status === "pending_review")).toBe(true);
  });
});
