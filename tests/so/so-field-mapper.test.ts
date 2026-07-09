import { describe, expect, it } from "vitest";

import { shipments } from "@/lib/mock-data";
import { applySoExtractionToShipment } from "@/lib/so/so-field-mapper";
import { extractSoFields } from "@/lib/so/so-extractor";

describe("applySoExtractionToShipment", () => {
  it("updates shipment fields from high-confidence SO extraction", () => {
    const extraction = extractSoFields([
      "SO: OOLU8791320",
      "Carrier: OOCL",
      "Vessel: OOCL Rauma",
      "Voyage: 068E",
      "ETD: 2026-06-12 23:00",
      "ETA: 2026-06-28 09:00",
      "POL: Yantian",
      "POD: Vancouver",
      "Container Type: 40HQ",
      "Pickup Location: Yantian Depot 3",
      "Return Location: Yantian Terminal 7",
    ].join("\n"));
    const result = applySoExtractionToShipment({ ...shipments[0], soStatus: "待识别" }, extraction);

    expect(result.appliedFields).toContain("soNo");
    expect(result.appliedFields).toContain("vesselVoyage");
    expect(result.shipment).toMatchObject({
      carrier: "OOCL",
      soNo: "OOLU8791320",
      soStatus: "已识别",
      status: "已放舱",
      vesselVoyage: "OOCL Rauma 068E",
    });
  });

  it("skips low-confidence fields until a human confirms them", () => {
    const extraction = extractSoFields([
      "SO: OOLU8791320",
      "Carrier: OOCL",
      "Vessel: OOCL Rauma",
      "Voyage: 068E",
      "ETD: 2026-06-12 23:00",
      "POL: Yantian",
      "POD: Vancouver",
      "Booking Agent: New Review Desk",
    ].join("\n"));
    const shipment = { ...shipments[0], bookingAgent: "Old Agent", soStatus: "待识别" as const };

    const withoutReview = applySoExtractionToShipment(shipment, extraction);
    expect(withoutReview.skippedFields).toContain("bookingAgent");
    expect(withoutReview.shipment.bookingAgent).toBe("Old Agent");

    const withReview = applySoExtractionToShipment(shipment, extraction, {
      fieldOverrides: [
        {
          apply: true,
          confirmed: true,
          fieldKey: "bookingAgent",
          value: "New Review Desk",
        },
      ],
    });
    expect(withReview.appliedFields).toContain("bookingAgent");
    expect(withReview.shipment.bookingAgent).toBe("New Review Desk");
  });
});
