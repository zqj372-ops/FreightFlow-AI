import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRepositoryCache, getRepositories, type RepositoryBundle } from "../index";
import { resetMockStore } from "../mock/mock-store";

describe("mock shipment repository", () => {
  let repos: RepositoryBundle;

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    resetMockStore();
    __resetRepositoryCache();
    repos = await getRepositories();
  });

  afterEach(() => {
    __resetRepositoryCache();
  });

  it("lists shipments in seeded order", async () => {
    const list = await repos.shipments.list();
    expect(list.map((s) => s.id)).toContain("SHP-240610-001");
    expect(list.map((s) => s.id)).toContain("SHP-240610-006");
  });

  it("returns a deep-cloned record from getById (mutations don't leak)", async () => {
    const first = await repos.shipments.getById("SHP-240610-001");
    expect(first).not.toBeNull();
    first!.status = "已开船";
    const second = await repos.shipments.getById("SHP-240610-001");
    expect(second!.status).not.toBe("已开船");
  });

  it("advances status and returns the updated record", async () => {
    const updated = await repos.shipments.advanceStatus({
      shipmentId: "SHP-240610-001",
      status: "已开船",
    });
    expect(updated?.status).toBe("已开船");

    const refetched = await repos.shipments.getById("SHP-240610-001");
    expect(refetched?.status).toBe("已开船");
  });

  it("records action logs without throwing", async () => {
    await expect(
      repos.shipments.recordActionLog({
        actionType: "催单提醒",
        actorName: "Ava",
        shipmentId: "SHP-240610-001",
        summary: "已增加一次催单记录",
      }),
    ).resolves.toBeUndefined();
  });

  it("returns null when advancing a missing shipment", async () => {
    const result = await repos.shipments.advanceStatus({
      shipmentId: "SHP-MISSING",
      status: "已开船",
    });
    expect(result).toBeNull();
  });
});
