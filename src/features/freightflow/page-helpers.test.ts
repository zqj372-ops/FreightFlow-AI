import { describe, expect, it } from "vitest";
import { shipments } from "@/lib/mock-data";
import {
  buildBookingDraft,
  buildBookingFormDraft,
  buildBookingPlanAttachmentPreview,
  buildBookingTrackingCard,
  buildContacts,
  buildPostBookingSendState,
  buildShipmentStatusEditDraft,
  buildShipmentBrief,
  buildShipmentDetailGroups,
  applyShipmentStatusEditDraft,
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
    expect(brief.primaryLine).toBe("批次 FF-CA-240610-A01 · SO 待代理回传 · 柜号 TEMU9088771 · 40HQ");
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

describe("buildBookingTrackingCard", () => {
  it("formats the booking tracking card fields with merged values and empty fallbacks", () => {
    const card = buildBookingTrackingCard({
      ...shipments[0],
      blTelexStatus: "待确认",
      cbm: "68.5 CBM",
      customsBroker: "Yantian Customs Desk",
      cutCustomsTime: "2026-06-11 16:00",
      cutWeightTime: "2026-06-11 14:00",
      grossWeight: "18,240 KG",
      oceanFreightPrice: "USD 2,450",
      packages: "860 CTNS",
      soStatus: "待识别",
      truckingCompany: "Shenzhen Port Trucking",
      vesselName: "",
      voyageNo: "",
    });

    expect(card.batchNo).toBe("FF-CA-240610-A01");
    expect(card.soNo).toBe("待代理回传");
    expect(card.containerNo).toBe("TEMU9088771");
    expect(card.bookingAgent).toBe("Seabay Logistics");
    expect(card.oceanFreightPrice).toBe("USD 2,450");
    expect(card.packageWeightVolume).toBe("860 CTNS / 18,240 KG / 68.5 CBM");
    expect(card.vesselVoyage).toBe("OOCL Rauma / 068E");
    expect(card.blTelexStatus).toEqual({ className: "border-amber-200 bg-amber-50 text-amber-700", label: "待确认" });
    expect(card.cutoffPills).toEqual([
      { label: "截单", value: "2026-06-11 18:00" },
      { label: "截重", value: "2026-06-11 14:00" },
      { label: "截关", value: "2026-06-11 16:00" },
    ]);
    expect(card.queryUrl).toBe("https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx");
  });

  it("uses dashes for missing optional booking tracking fields", () => {
    const card = buildBookingTrackingCard({
      ...shipments[0],
      blTelexStatus: "",
      cbm: "",
      containerNo: "",
      cutCustomsTime: "",
      cutWeightTime: "",
      grossWeight: "",
      oceanFreightPrice: "",
      packages: "",
      soNo: "",
      vesselName: "",
      vesselVoyage: "",
      voyageNo: "",
    });

    expect(card.soNo).toBe("-");
    expect(card.containerNo).toBe("-");
    expect(card.oceanFreightPrice).toBe("-");
    expect(card.packageWeightVolume).toBe("- / - / -");
    expect(card.vesselVoyage).toBe("- / -");
    expect(card.blTelexStatus.label).toBe("未确认");
    expect(card.cutoffPills).toEqual([
      { label: "截单", value: "2026-06-11 18:00" },
      { label: "截重", value: "-" },
      { label: "截关", value: "-" },
    ]);
  });
});

describe("buildShipmentStatusEditDraft", () => {
  it("builds editable status detail fields from automatically captured shipment data", () => {
    const draft = buildShipmentStatusEditDraft(shipments[0]);

    expect(draft).toMatchObject({
      carrier: "OOCL",
      containerNo: "TEMU9088771",
      cutoffTime: "2026-06-11 18:00",
      documentStatus: "待生成",
      etd: "2026-06-12 23:00",
      mailStatus: "跟进中",
      nextAction: shipments[0].nextAction,
      operator: "Ava",
      soNo: "待代理回传 SO",
      soStatus: "待识别",
      status: "已催放舱",
    });
  });
});

describe("applyShipmentStatusEditDraft", () => {
  it("applies manual corrections to auto-entered shipment information", () => {
    const next = applyShipmentStatusEditDraft(shipments[0], {
      ...buildShipmentStatusEditDraft(shipments[0]),
      containerNo: "TEMU0000001",
      followUpCount: "3",
      mailStatus: "已发送",
      nextAction: "等待代理回传 SO。",
      soStatus: "已识别",
      status: "已放舱",
    });

    expect(next.containerNo).toBe("TEMU0000001");
    expect(next.followUpCount).toBe(3);
    expect(next.mailStatus).toBe("已发送");
    expect(next.nextAction).toBe("等待代理回传 SO。");
    expect(next.soStatus).toBe("已识别");
    expect(next.status).toBe("已放舱");
    expect(next.reminderFlags).toContain("人工修正状态明细");
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

describe("buildBookingFormDraft", () => {
  it("builds editable booking plan form defaults from the selected shipment", () => {
    const form = buildBookingFormDraft(shipments[0]);

    expect(form).toEqual({
      bookingAgent: "Seabay Logistics",
      carrier: "OOCL",
      containerType: "40HQ",
      destinationPort: "Vancouver",
      etd: "2026-06-12 23:00",
      originPort: "Yantian",
      pickupLocation: "Yantian Depot 3",
      remarks: "请协助订舱并回传 SO / 放舱确认。",
      returnLocation: "Yantian Terminal 7",
      vesselVoyage: "OOCL Rauma 068E",
    });
  });
});

describe("buildBookingPlanAttachmentPreview", () => {
  it("creates an attachment filename and human-readable booking request preview", () => {
    const preview = buildBookingPlanAttachmentPreview(shipments[0], buildBookingFormDraft(shipments[0]));

    expect(preview.fileName).toBe("FF-CA-240610-A01-booking-request.html");
    expect(preview.lines).toContain("批次号：FF-CA-240610-A01");
    expect(preview.lines).toContain("船公司：OOCL");
    expect(preview.lines).toContain("备注：请协助订舱并回传 SO / 放舱确认。");
    expect(preview.html).toContain("<h1>订舱申请</h1>");
    expect(preview.html).toContain("FF-CA-240610-A01");
  });
});

describe("buildPostBookingSendState", () => {
  it("moves the shipment into waiting for SO after manual booking email confirmation", () => {
    const next = buildPostBookingSendState(shipments[0], "2026-06-13 20:00");

    expect(next.mailStatus).toBe("已发送");
    expect(next.status).toBe("等待放舱");
    expect(next.soStatus).toBe("待识别");
    expect(next.lastEmailTime).toBe("2026-06-13 20:00");
    expect(next.nextAction).toBe("等待代理回传 SO 信息，IMAP 识别后人工确认写回。");
    expect(next.reminderFlags).toContain("等待 SO 回传");
  });
});
