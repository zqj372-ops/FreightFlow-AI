import { BookingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { normalizeShipmentAction, shipmentCreateData, shipmentUpdateData } from "./freightflow-data";
import { shipments } from "./mock-data";

describe("shipment data mapping", () => {
  it("persists bookingStatus on create and update payloads", () => {
    const record = { ...shipments[0], bookingStatus: "SO 已收到" as const };

    expect(shipmentCreateData(record).bookingStatus).toBe(BookingStatus.SO_RECEIVED);
    expect(shipmentUpdateData(record).bookingStatus).toBe(BookingStatus.SO_RECEIVED);
  });
});

describe("normalizeShipmentAction", () => {
  it("keeps explicit SO workflow stages for action persistence", () => {
    const parsed = normalizeShipmentAction({
      action: "SO 识别",
      soStage: "applied",
      source: "SYSTEM",
    });

    expect(parsed).toEqual({
      value: {
        action: "SO 识别",
        soStage: "applied",
        source: "SYSTEM",
      },
    });
  });

  it("rejects unknown SO workflow stages", () => {
    expect(normalizeShipmentAction({ action: "SO 识别", soStage: "unknown" })).toEqual({
      error: "soStage must be received, reviewing, or applied.",
    });
  });
});
