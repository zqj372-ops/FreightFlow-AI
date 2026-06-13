import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockShipmentRepository,
  resetMockStore,
  setMockStore,
} from "@/lib/repositories/mock";

describe("MockShipmentRepository", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    setMockStore(null);
  });

  it("lists all seeded shipments", async () => {
    const repo = new MockShipmentRepository();
    const all = await repo.list();

    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty("id");
    expect(all[0]).toHaveProperty("status");
  });

  it("returns a deep clone so callers cannot mutate the store", async () => {
    const repo = new MockShipmentRepository();
    const first = (await repo.list())[0]!;
    first.status = "已签收";

    const second = (await repo.list())[0]!;
    expect(second.status).not.toBe("已签收");
  });

  it("finds a shipment by id and returns null when missing", async () => {
    const repo = new MockShipmentRepository();
    const list = await repo.list();
    const found = await repo.getById(list[0]!.id);
    expect(found?.id).toBe(list[0]!.id);

    const missing = await repo.getById("does-not-exist");
    expect(missing).toBeNull();
  });

  it("advances status with a status override and patch", async () => {
    const repo = new MockShipmentRepository();
    const list = await repo.list();
    const target = list[0]!;

    const next = await repo.advanceStatus({ patch: { operator: "QA" }, shipmentId: target.id, status: "已放舱" });
    expect(next).not.toBeNull();
    expect(next?.status).toBe("已放舱");
    expect(next?.operator).toBe("QA");

    const refetched = await repo.getById(target.id);
    expect(refetched?.status).toBe("已放舱");
  });

  it("returns null from advanceStatus when shipment does not exist", async () => {
    const repo = new MockShipmentRepository();
    const next = await repo.advanceStatus({ shipmentId: "missing-id" });
    expect(next).toBeNull();
  });

  it("records an action log as a reminder flag without throwing", async () => {
    const repo = new MockShipmentRepository();
    const list = await repo.list();
    const target = list[0]!;

    await expect(
      repo.recordActionLog({
        actionType: "催单提醒",
        shipmentId: target.id,
        summary: "Auto nudge after 4h waiting",
      }),
    ).resolves.toBeUndefined();

    const refetched = await repo.getById(target.id);
    expect(refetched?.reminderFlags.some((flag) => flag.includes("催单提醒"))).toBe(true);
  });
});
