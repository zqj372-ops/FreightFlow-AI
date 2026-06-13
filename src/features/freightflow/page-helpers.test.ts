import { describe, expect, it } from "vitest";
import { shipments } from "@/lib/mock-data";
import { buildBookingDraft, buildContacts, isValidEmail, normalizeEmail, pickRecommendedAction } from "./page-helpers";

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
