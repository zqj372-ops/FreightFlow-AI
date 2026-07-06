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
  it("applies follow-up once and keeps reminder flags unique", () => {
    const { record, summary } = applyShipmentAction(
      {
        ...shipments[5],
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
      status: "已催放舱",
      reminderFlags: ["已手动催单"],
    });
  });

  it("marks and clears exceptions through the same action", () => {
    const marked = applyShipmentAction(
      { ...shipments[1], exceptions: [], status: "待补料" },
      { action: "异常标记", exceptionMessage: "SO 件数不一致" },
      actionTime,
    );

    expect(marked.record.status).toBe("异常处理中");
    expect(marked.record.exceptions).toEqual(["SO 件数不一致"]);

    const cleared = applyShipmentAction(marked.record, { action: "异常标记" }, actionTime);

    expect(cleared.record.status).toBe("待补料");
    expect(cleared.record.exceptions).toEqual([]);
  });
});
