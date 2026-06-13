import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockBookingPlanRepository,
  resetMockStore,
  setMockStore,
} from "@/lib/repositories/mock";

describe("MockBookingPlanRepository", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    setMockStore(null);
  });

  it("seeds one plan per shipment", async () => {
    const repo = new MockBookingPlanRepository();
    const plans = await repo.list();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => typeof plan.shipmentId === "string")).toBe(true);
  });

  it("looks up plans by shipmentId and returns null for unknown ids", async () => {
    const repo = new MockBookingPlanRepository();
    const plans = await repo.list();
    const found = await repo.getByShipmentId(plans[0]!.shipmentId);
    expect(found?.id).toBe(plans[0]!.id);

    const missing = await repo.getByShipmentId("SHP-UNKNOWN");
    expect(missing).toBeNull();
  });

  it("upserts a plan by shipmentId, replacing the existing one", async () => {
    const repo = new MockBookingPlanRepository();
    const plans = await repo.list();
    const existing = plans[0]!;

    const updated = await repo.upsertForShipment({
      batchNo: existing.batchNo,
      bookingAgent: existing.bookingAgent,
      containerType: existing.containerType,
      destinationPort: existing.destinationPort,
      originPort: existing.originPort,
      planStatus: "sent",
      preferredBookingAgent: "Alternate Agent",
      shipmentId: existing.shipmentId,
      snapshot: { missingFields: [], riskFlags: [] },
    });

    expect(updated.planStatus).toBe("sent");
    expect(updated.preferredBookingAgent).toBe("Alternate Agent");
    expect(updated.id).toBe(existing.id);
  });

  it("updates the plan status and writes lastDraftId", async () => {
    const repo = new MockBookingPlanRepository();
    const plans = await repo.list();
    const target = plans[0]!;

    const next = await repo.updateStatus({
      id: target.id,
      lastDraftId: "draft-x",
      planStatus: "draft_ready",
    });
    expect(next?.planStatus).toBe("draft_ready");
    expect(next?.lastDraftId).toBe("draft-x");
  });

  it("binds a draft to a plan and clears it when set to null", async () => {
    const repo = new MockBookingPlanRepository();
    const plans = await repo.list();
    const target = plans[0]!;

    const bound = await repo.bindLastDraft(target.id, "draft-1");
    expect(bound?.lastDraftId).toBe("draft-1");

    const cleared = await repo.bindLastDraft(target.id, null);
    expect(cleared?.lastDraftId).toBeNull();
  });
});
