import { describe, expect, it } from "vitest";

import { matchEmailToShipment } from "@/lib/email/email-thread-matcher";
import { shipments } from "@/lib/mock-data";

describe("matchEmailToShipment", () => {
  it("matches reply threads by batch number and booking language", () => {
    const match = matchEmailToShipment(
      {
        attachments: [],
        body: "Booking confirmation for FF-CA-240610-A01 is attached.",
        from: "agent@example.com",
        receivedAt: "2026-06-10T12:00:00.000Z",
        subject: "Re: FF-CA-240610-A01 booking",
      },
      shipments,
    );

    expect(match?.shipment.id).toBe("SHP-240610-001");
    expect(match?.score).toBeGreaterThanOrEqual(4);
  });

  it("rejects low-score messages", () => {
    const match = matchEmailToShipment(
      {
        attachments: [],
        body: "Weekly newsletter",
        from: "news@example.com",
        receivedAt: "2026-06-10T12:00:00.000Z",
        subject: "Market update",
      },
      shipments,
    );

    expect(match).toBeNull();
  });
});
