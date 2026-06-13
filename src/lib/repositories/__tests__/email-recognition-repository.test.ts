import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockEmailRecognitionRepository,
  resetMockStore,
  setMockStore,
} from "@/lib/repositories/mock";

describe("MockEmailRecognitionRepository", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    setMockStore(null);
  });

  it("lists only pending_review recognitions joined with their email", async () => {
    const repo = new MockEmailRecognitionRepository();
    const pending = await repo.listPending();

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((rec) => rec.status === "pending_review")).toBe(true);
    expect(pending.every((rec) => typeof rec.emailMessage.subject === "string")).toBe(true);
  });

  it("finds a recognition by id with its emailMessage attached", async () => {
    const repo = new MockEmailRecognitionRepository();
    const pending = await repo.listPending();
    const found = await repo.getById(pending[0]!.id);

    expect(found?.id).toBe(pending[0]!.id);
    expect(found?.emailMessage.id).toBe(pending[0]!.emailMessageId);
  });

  it("returns null from getById when the id is unknown", async () => {
    const repo = new MockEmailRecognitionRepository();
    const found = await repo.getById("does-not-exist");
    expect(found).toBeNull();
  });

  it("creates a new recognition record", async () => {
    const repo = new MockEmailRecognitionRepository();
    const messages = await new MockEmailRecognitionRepository().listPending();

    const created = await repo.create({
      confidence: 0.9,
      emailMessageId: messages[0]!.emailMessageId,
      extractedFields: { soNo: "OOLU1" },
      matchedShipmentId: null,
      recognitionType: "SO_RECEIVED",
      riskFlags: [],
      status: "pending_review",
      summary: "Mock recognition",
    });

    expect(created.id).toMatch(/^mock-rec-/);
    expect(created.extractedFields.soNo).toBe("OOLU1");
  });

  it("updates the status of a recognition", async () => {
    const repo = new MockEmailRecognitionRepository();
    const pending = await repo.listPending();
    const target = pending[0]!;

    const updated = await repo.updateStatus({
      id: target.id,
      reviewedAt: "2026-06-14T00:00:00.000Z",
      reviewedBy: "ops-team",
      status: "confirmed",
    });

    expect(updated?.status).toBe("confirmed");
    expect(updated?.reviewedBy).toBe("ops-team");

    const pendingAfter = await repo.listPending();
    expect(pendingAfter.find((rec) => rec.id === target.id)).toBeUndefined();
  });
});
