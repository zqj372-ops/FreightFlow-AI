import { describe, expect, it } from "vitest";
import { shipments } from "@/lib/mock-data";
import {
  buildBookingDraft,
  buildContacts,
  buildShipmentBrief,
  buildShipmentDetailGroups,
  canCreateBookingPlanFromShipment,
  isValidEmail,
  normalizeEmail,
  pickRecommendedAction,
} from "./page-helpers";

describe("buildBookingDraft", () => {
  it("builds a booking email draft from shipment fields", () => {
    const draft = buildBookingDraft(shipments[0]);

    expect(draft.to).toEqual(["seabay.logistics@freightflow.ai"]);
    expect(draft.cc).toEqual(["ops@freightflow.ai"]);
    expect(draft.subject).toBe("FF-CA-240610-A01 Booking Request | 40HQ | Yantian - Vancouver");
    expect(draft.attachmentName).toBe("FF-CA-240610-A01-shipping-instruction.pdf");
    expect(draft.body).toContain("Dear Seabay Logistics,");
    expect(draft.body).toContain("Carrier: OOCL");
    expect(draft.body).toContain("ETD: 2026-06-12 23:00");
  });
});

describe("buildContacts", () => {
  it("creates default shipment contacts without duplicate emails", () => {
    const contacts = buildContacts(shipments[0]);

    expect(contacts).toEqual([
      {
        email: "seabay.logistics@freightflow.ai",
        label: "Seabay Logistics booking desk",
        role: "booking_agent",
      },
      {
        email: "ops@freightflow.ai",
        label: "FreightFlow operations",
        role: "ops",
      },
      {
        email: "ava@freightflow.ai",
        label: "Ava operator",
        role: "ops",
      },
      {
        email: "sales@freightflow.ai",
        label: "Sales owner",
        role: "sales",
      },
      {
        email: "customs.docs@freightflow.ai",
        label: "Customs documents",
        role: "customs",
      },
    ]);
    expect(new Set(contacts.map((contact) => contact.email)).size).toBe(contacts.length);
  });
});

describe("normalizeEmail", () => {
  it("trims whitespace and trailing email delimiters", () => {
    expect(normalizeEmail("  Agent.Desk@Example.com;, ")).toBe("Agent.Desk@Example.com");
  });
});

describe("isValidEmail", () => {
  it.each(["ops@freightflow.ai", "agent.desk@example.co", "a+b@example.com"])(
    "accepts %s",
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each(["", "ops", "ops@", "ops@example", "ops example@freightflow.ai"])(
    "rejects %s",
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe("pickRecommendedAction", () => {
  it("prioritizes exception handling", () => {
    expect(pickRecommendedAction({ ...shipments[0], status: "异常处理中" })).toBe("异常标记");
  });

  it("recommends booking email before other normal flow actions", () => {
    expect(pickRecommendedAction({ ...shipments[0], mailStatus: "未发送" })).toBe("订舱邮件");
  });

  it("recommends document preparation for pending document statuses", () => {
    expect(pickRecommendedAction({ ...shipments[0], mailStatus: "已发送", status: "待补料" })).toBe("补料文件");
  });

  it("falls back to declaration workflow for sailed shipments", () => {
    expect(pickRecommendedAction({ ...shipments[0], mailStatus: "已发送", soStatus: "已识别", status: "已开船" })).toBe(
      "AMS/ACI/ISF",
    );
  });
});

describe("buildShipmentBrief", () => {
  it("returns decision-focused summary fields for the current shipment card", () => {
    const brief = buildShipmentBrief(shipments[0]);

    expect(brief.route).toBe("Yantian → Vancouver");
    expect(brief.primaryLine).toBe("SO OOLU8791320 · 柜号 TEMU9088771 · 40HQ");
    expect(brief.timing).toBe("ETD 2026-06-12 23:00 / ETA 2026-06-28 09:00");
    expect(brief.summaryItems).toEqual([
      { label: "航线", value: "Yantian → Vancouver" },
      { label: "船名航次", value: "OOCL Rauma 068E" },
      { label: "柜型", value: "40HQ" },
      { label: "责任人", value: "Ava · Seabay Logistics" },
    ]);
  });
});

describe("buildShipmentDetailGroups", () => {
  it("groups full shipment fields for the detail drawer", () => {
    const groups = buildShipmentDetailGroups(shipments[0]);

    expect(groups.map((group) => group.title)).toEqual(["基础信息", "航线与时效", "作业地点", "单证与提醒"]);
    expect(groups[0].items).toContainEqual({ label: "批次号", value: "FF-CA-240610-A01" });
    expect(groups[1].items).toContainEqual({ label: "截补料", value: "2026-06-11 18:00" });
    expect(groups[2].items).toContainEqual({ label: "提柜地点", value: "Yantian Depot 3" });
    expect(groups[3].items).toContainEqual({ label: "SO 状态", value: "待识别" });
  });
});

describe("canCreateBookingPlanFromShipment", () => {
  it("allows a booking plan when the shipment is ready to draft", () => {
    const result = canCreateBookingPlanFromShipment({ ...shipments[0], mailStatus: "未发送" });

    expect(result).toEqual({ canCreate: true, message: "可新建订舱计划并生成中文草稿" });
  });

  it("allows a booking plan for followed-up shipments that still need manual confirmation", () => {
    const result = canCreateBookingPlanFromShipment({ ...shipments[0], mailStatus: "跟进中" });

    expect(result).toEqual({ canCreate: true, message: "可新建订舱计划并生成中文草稿" });
  });

  it("blocks creation with a Chinese reason when required fields are missing", () => {
    const result = canCreateBookingPlanFromShipment({
      ...shipments[0],
      bookingAgent: "",
      containerType: "",
      mailStatus: "未发送",
    });

    expect(result).toEqual({ canCreate: false, message: "资料缺失：订舱代理、柜型" });
  });

  it("blocks creation when the booking email has already been sent", () => {
    const result = canCreateBookingPlanFromShipment({ ...shipments[0], mailStatus: "已发送" });

    expect(result).toEqual({ canCreate: false, message: "订舱邮件已发送" });
  });
});
