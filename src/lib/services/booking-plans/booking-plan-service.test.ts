import { describe, expect, it } from "vitest";

import { shipments } from "@/lib/mock-data";

import { createMockBookingDraftBatch, listMockBookingPlans } from "./booking-plan-service";

const draftableShipment = shipments.find((shipment) => shipment.status === "待订舱") ?? shipments[0];

describe("listMockBookingPlans", () => {
  it("builds booking plans from mock shipments without sent plans", () => {
    const plans = listMockBookingPlans([
      { ...draftableShipment, id: "SHP-PENDING", mailStatus: "未发送" },
      { ...shipments[1], id: "SHP-SENT", mailStatus: "已发送" },
    ]);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      batchNo: draftableShipment.batchNo,
      planStatus: "ready_to_draft",
      shipmentId: "SHP-PENDING",
    });
  });
});

describe("createMockBookingDraftBatch", () => {
  it("returns success, skipped, and failed counts for selected shipments", () => {
    const result = createMockBookingDraftBatch(
      ["SHP-READY", "SHP-MISSING", "SHP-UNKNOWN"],
      [
        { ...draftableShipment, id: "SHP-READY", mailStatus: "未发送" },
        {
          ...draftableShipment,
          bookingAgent: "",
          containerType: "",
          id: "SHP-MISSING",
          mailStatus: "未发送",
        },
      ],
    );

    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.items[0].draft?.subject).toContain("订舱申请");
    expect(result.items[1].message).toBe("资料缺失：订舱代理、柜型");
    expect(result.items[2].message).toBe("未找到 Shipment");
  });
});
