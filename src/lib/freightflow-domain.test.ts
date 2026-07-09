import { describe, expect, it } from "vitest";

import { shipments } from "./mock-data";
import {
  applyShipmentAction,
  formatActionTimestamp,
  formatFreightFlowEmail,
  isDetailActionLabel,
} from "./freightflow-domain";

const actionTime = new Date(2026, 5, 11, 9, 5);

describe("formatFreightFlowEmail", () => {
  it("normalizes display names into demo email addresses", () => {
    expect(formatFreightFlowEmail("Seabay Logistics")).toBe("seabay.logistics@freightflow.ai");
  });
});

describe("formatActionTimestamp", () => {
  it("formats timestamps with padded local date and time parts", () => {
    expect(formatActionTimestamp(actionTime)).toBe("2026-06-11 09:05");
  });
});

describe("isDetailActionLabel", () => {
  it("accepts only known shipment actions", () => {
    expect(isDetailActionLabel("催单提醒")).toBe(true);
    expect(isDetailActionLabel("不存在动作")).toBe(false);
  });
});

describe("applyShipmentAction", () => {
  it("marks booking email as sent in the booking workflow", () => {
    const { record, summary } = applyShipmentAction(
      {
        ...shipments[5],
        bookingStatus: "订舱草稿",
        mailStatus: "未发送",
        status: "等待放舱",
      },
      { action: "订舱邮件", subject: "Booking request FF-US-240610-F21" },
      actionTime,
    );

    expect(summary).toBe("已记录订舱邮件：Booking request FF-US-240610-F21");
    expect(record).toMatchObject({
      bookingStatus: "已发送订舱",
      lastEmailTime: "2026-06-11 09:05",
      mailStatus: "已发送",
      status: "已发送订舱",
    });
  });

  it("applies follow-up once and keeps reminder flags unique", () => {
    const { record, summary } = applyShipmentAction(
      {
        ...shipments[5],
        bookingStatus: "已发送订舱",
        reminderFlags: ["已手动催单"],
        status: "等待放舱",
      },
      { action: "催单提醒" },
      actionTime,
    );

    expect(summary).toBe("已增加一次催单记录");
    expect(record).toMatchObject({
      followUpCount: shipments[5].followUpCount + 1,
      lastEmailTime: "2026-06-11 09:05",
      mailStatus: "跟进中",
      bookingStatus: "等待 SO",
      status: "已催放舱",
      reminderFlags: ["已手动催单"],
    });
  });

  it("moves SO received, reviewing, and applied through explicit booking states", () => {
    const received = applyShipmentAction(
      { ...shipments[5], bookingStatus: "已发送订舱", soStatus: "待识别", status: "已发送订舱" },
      { action: "SO 识别", soStage: "received" },
      actionTime,
    );

    expect(received.record).toMatchObject({
      bookingStatus: "SO 已收到",
      soStatus: "待识别",
      status: "等待放舱",
    });

    const reviewing = applyShipmentAction(
      received.record,
      { action: "SO 识别", soStage: "reviewing" },
      actionTime,
    );

    expect(reviewing.record).toMatchObject({
      bookingStatus: "SO 复核中",
      soStatus: "已识别",
    });

    const applied = applyShipmentAction(
      reviewing.record,
      { action: "SO 识别", soStage: "applied" },
      actionTime,
    );

    expect(applied.record).toMatchObject({
      bookingStatus: "已放舱",
      soStatus: "已识别",
      status: "已放舱",
    });
  });

  it("marks and clears exceptions through the same action", () => {
    const marked = applyShipmentAction(
      { ...shipments[1], exceptions: [], status: "待补料" },
      { action: "异常标记", exceptionMessage: "SO 件数不一致" },
      actionTime,
    );

    expect(marked.record.status).toBe("异常处理中");
    expect(marked.record.bookingStatus).toBe("失败");
    expect(marked.record.exceptions).toEqual(["SO 件数不一致"]);

    const cleared = applyShipmentAction(marked.record, { action: "异常标记" }, actionTime);

    expect(cleared.record.status).toBe("待补料");
    expect(cleared.record.bookingStatus).toBe("待补料");
    expect(cleared.record.exceptions).toEqual([]);
  });
});
