import { describe, expect, it } from "vitest";
import { getAlertLevel, shipments, summarizeShipments, type ShipmentRecord } from "./mock-data";

function makeShipment(overrides: Partial<ShipmentRecord>): ShipmentRecord {
  return {
    ...shipments[0],
    exceptions: [],
    followUpCount: 0,
    hoursToCutoff: 48,
    status: "等待放舱",
    ...overrides,
  };
}

describe("summarizeShipments", () => {
  it("summarizes the current mock shipment queue", () => {
    expect(summarizeShipments(shipments)).toEqual({
      total: 6,
      redAlerts: 3,
      yellowAlerts: 1,
      greenNormal: 2,
      waitingRelease: 2,
      pendingDocs: 2,
    });
  });

  it("keeps counts at zero for an empty queue", () => {
    expect(summarizeShipments([])).toEqual({
      total: 0,
      redAlerts: 0,
      yellowAlerts: 0,
      greenNormal: 0,
      waitingRelease: 0,
      pendingDocs: 0,
    });
  });
});

describe("getAlertLevel", () => {
  it("marks explicit exceptions as red", () => {
    expect(getAlertLevel(makeShipment({ exceptions: ["SO 柜型不一致"] }))).toBe("red");
  });

  it("marks cutoff at or below 6 hours as red", () => {
    expect(getAlertLevel(makeShipment({ hoursToCutoff: 6 }))).toBe("red");
  });

  it("marks cutoff at or below 24 hours as yellow", () => {
    expect(getAlertLevel(makeShipment({ hoursToCutoff: 24 }))).toBe("yellow");
  });

  it("marks followed-up shipments as yellow", () => {
    expect(getAlertLevel(makeShipment({ followUpCount: 1, hoursToCutoff: 48 }))).toBe("yellow");
  });

  it("marks otherwise healthy shipments as green", () => {
    expect(getAlertLevel(makeShipment({ followUpCount: 0, hoursToCutoff: 48 }))).toBe("green");
  });
});
