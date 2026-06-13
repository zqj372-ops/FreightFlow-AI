import { describe, expect, it } from "vitest";

import { shipments } from "@/lib/mock-data";

import { classifyEmailMessage, matchShipmentForEmail } from "./email-recognition-rules";

describe("classifyEmailMessage", () => {
  it("classifies Chinese SO release emails", () => {
    const result = classifyEmailMessage({
      bodyText: "您好，SO已出，附件请查收。SO: OOLU8791320，船名航次 OOCL Rauma 068E。",
      from: "agent@example.com",
      messageId: "msg-so-cn",
      subject: "SO已出 - FF-CA-240610-A01",
    });

    expect(result.recognitionType).toBe("SO_RECEIVED");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.summary).toContain("SO 回传");
    expect(result.extractedFields.soNo).toBe("OOLU8791320");
  });

  it("classifies English SI confirmation emails", () => {
    const result = classifyEmailMessage({
      bodyText: "Dear team, SI Confirmed for COSU5519028. Documents are confirmed.",
      from: "agent@example.com",
      messageId: "msg-si-en",
      subject: "SI Confirmed / Booking Confirmation",
    });

    expect(result.recognitionType).toBe("SUPPLEMENT_CONFIRMED");
    expect(result.summary).toContain("补料确认");
  });

  it("classifies container type mismatch as exception", () => {
    const result = classifyEmailMessage({
      bodyText: "代理反馈柜型不符，请确认是否由 40HQ 改为 40GP。",
      from: "agent@example.com",
      messageId: "msg-exception-cn",
      subject: "柜型不符，请修改资料",
    });

    expect(result.recognitionType).toBe("EXCEPTION");
    expect(result.riskFlags).toContain("柜型不符");
  });

  it("keeps unrelated emails unknown", () => {
    const result = classifyEmailMessage({
      bodyText: "FYI, office will close early this Friday.",
      from: "notice@example.com",
      messageId: "msg-unknown",
      subject: "Office notice",
    });

    expect(result.recognitionType).toBe("UNKNOWN");
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("matchShipmentForEmail", () => {
  it("matches shipment by batch number and SO number", () => {
    const matched = matchShipmentForEmail(
      {
        bodyText: "SO OOLU8791320 已出。",
        from: "agent@example.com",
        messageId: "msg-match",
        subject: "FF-CA-240610-A01 SO已出",
      },
      shipments,
    );

    expect(matched?.id).toBe("SHP-240610-001");
  });
});
