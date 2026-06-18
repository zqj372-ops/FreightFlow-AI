import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRepositoryCache, getRepositories, type RepositoryBundle } from "../index";
import { resetMockStore } from "../mock/mock-store";

describe("mock booking plan repository", () => {
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

  it("seeds plans for the mock shipments", async () => {
    const plans = await repos.bookingPlans.list();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.shipmentId.length > 0)).toBe(true);
    expect(plans.every((plan) => plan.planStatus === "draft_ready")).toBe(true);
  });

  it("upserts a new plan for a shipment without one", async () => {
    const plan = await repos.bookingPlans.upsertForShipment({
      batchNo: "FF-TEST-BATCH",
      bookingAgent: "Test Agent",
      containerType: "40HQ",
      destinationPort: "Vancouver",
      id: "plan-test",
      lastError: null,
      originPort: "Yantian",
      planStatus: "ready_to_draft",
      preferredBookingAgent: "Test Agent",
      shipmentId: "SHP-240610-006",
      snapshot: { missingFields: [], riskFlags: ["ready"] },
    });
    expect(plan.planStatus).toBe("ready_to_draft");
    expect(plan.preferredBookingAgent).toBe("Test Agent");

    const found = await repos.bookingPlans.getByShipmentId("SHP-240610-006");
    expect(found?.id).toBe("plan-test");
  });

  it("updates the plan status and preserves missing fields", async () => {
    const seeded = await repos.bookingPlans.getByShipmentId("SHP-240610-006");
    expect(seeded).not.toBeNull();

    const updated = await repos.bookingPlans.updateStatus({
      id: seeded!.id,
      lastError: "代理回邮超时",
      planStatus: "send_failed",
    });

    expect(updated?.planStatus).toBe("send_failed");
    expect(updated?.lastError).toBe("代理回邮超时");
    expect(updated?.missingFields).toEqual(seeded!.missingFields);
  });

  it("binds a draft id to a plan and clears it again", async () => {
    const seeded = await repos.bookingPlans.getByShipmentId("SHP-240610-006");
    expect(seeded).not.toBeNull();

    const bound = await repos.bookingPlans.bindLastDraft(seeded!.id, "draft-123");
    expect(bound?.lastDraftId).toBe("draft-123");

    const cleared = await repos.bookingPlans.bindLastDraft(seeded!.id, null);
    expect(cleared?.lastDraftId).toBeNull();
  });

  it("returns null when updating a non-existent plan", async () => {
    const updated = await repos.bookingPlans.updateStatus({
      id: "plan-does-not-exist",
      planStatus: "sent",
    });
    expect(updated).toBeNull();
  });
});
