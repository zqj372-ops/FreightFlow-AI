import { describe, expect, it } from "vitest";
import { shipments } from "@/lib/mock-data";
import {
  buildBookingDraftBatchResult,
  buildBookingDraftPlan,
  buildBookingPlanRecords,
  evaluateBookingPlanReadiness,
} from "./booking-plan-rules";

describe("evaluateBookingPlanReadiness", () => {
  it("marks a complete unsent shipment as ready to draft", () => {
    const result = evaluateBookingPlanReadiness({
      ...shipments[0],
      mailStatus: "未发送",
    });

    expect(result.status).toBe("ready_to_draft");
    expect(result.missingFields).toEqual([]);
    expect(result.riskFlags).toContain("可生成订舱草稿");
  });

  it("keeps a followed-up but unsent shipment ready for a pending booking draft", () => {
    const result = evaluateBookingPlanReadiness({
      ...shipments[0],
      mailStatus: "跟进中",
    });

    expect(result.status).toBe("ready_to_draft");
    expect(result.riskFlags).toContain("可生成订舱草稿");
  });

  it("marks missing booking agent and container type as missing info", () => {
    const result = evaluateBookingPlanReadiness({
      ...shipments[0],
      bookingAgent: "",
      containerType: "",
      mailStatus: "未发送",
    });

    expect(result.status).toBe("missing_info");
    expect(result.missingFields).toEqual(["订舱代理", "柜型"]);
    expect(result.riskFlags).toEqual(["缺订舱代理", "缺柜型"]);
  });

  it("keeps already-sent shipments out of the pending booking plan queue", () => {
    const result = evaluateBookingPlanReadiness({
      ...shipments[0],
      mailStatus: "已发送",
    });

    expect(result.status).toBe("sent");
    expect(result.riskFlags).toEqual(["订舱邮件已发送"]);
  });
});

describe("buildBookingDraftPlan", () => {
  it("generates a Chinese booking draft from shipment data", () => {
    const draft = buildBookingDraftPlan(shipments[0]);

    expect(draft.subject).toBe("订舱申请｜FF-CA-240610-A01｜40HQ｜Yantian-Vancouver");
    expect(draft.to).toEqual(["seabay.logistics@freightflow.ai"]);
    expect(draft.cc).toEqual(["ops@freightflow.ai"]);
    expect(draft.attachmentName).toBe("FF-CA-240610-A01-shipping-instruction.pdf");
    expect(draft.body).toContain("您好，");
    expect(draft.body).toContain("请协助安排以下订舱");
    expect(draft.body).toContain("船公司：OOCL");
    expect(draft.body).toContain("预计 ETD：2026-06-12 23:00");
  });
});

describe("buildBookingPlanRecords", () => {
  it("lists only shipments that still need booking work", () => {
    const records = buildBookingPlanRecords([
      { ...shipments[0], mailStatus: "未发送" },
      { ...shipments[1], mailStatus: "已发送" },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      batchNo: "FF-CA-240610-A01",
      planStatus: "ready_to_draft",
      shipmentId: "SHP-240610-001",
    });
  });
});

describe("buildBookingDraftBatchResult", () => {
  it("generates drafts for ready shipments and skips incomplete shipments", () => {
    const result = buildBookingDraftBatchResult(
      ["SHP-READY", "SHP-MISSING", "SHP-UNKNOWN"],
      [
        { ...shipments[0], id: "SHP-READY", mailStatus: "未发送" },
        {
          ...shipments[1],
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
    expect(result.items.map((item) => item.status)).toEqual(["success", "skipped", "failed"]);
    expect(result.items[0].draft?.subject).toContain("订舱申请");
    expect(result.items[1].message).toBe("资料缺失：订舱代理、柜型");
    expect(result.items[2].message).toBe("未找到 Shipment");
  });
});
