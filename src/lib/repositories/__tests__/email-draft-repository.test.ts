import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockEmailDraftRepository,
  resetMockStore,
  setMockStore,
} from "@/lib/repositories/mock";

describe("MockEmailDraftRepository", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    setMockStore(null);
  });

  it("lists the seeded drafts and returns a deep clone", async () => {
    const repo = new MockEmailDraftRepository();
    const drafts = await repo.list();
    expect(drafts.length).toBeGreaterThan(0);

    drafts[0]!.status = "sent";
    const refetched = await repo.list();
    expect(refetched[0]!.status).not.toBe("sent");
  });

  it("finds a draft by id and returns null when missing", async () => {
    const repo = new MockEmailDraftRepository();
    const list = await repo.list();
    const found = await repo.getById(list[0]!.id);
    expect(found?.id).toBe(list[0]!.id);

    const missing = await repo.getById("nope");
    expect(missing).toBeNull();
  });

  it("creates a new draft and returns it with an id and timestamps", async () => {
    const repo = new MockEmailDraftRepository();
    const list = await repo.list();
    const before = list.length;

    const created = await repo.create({
      attachmentName: null,
      body: "Test body",
      cc: [],
      createdFromPlanId: null,
      draftType: "booking",
      shipmentId: list[0]!.shipmentId,
      status: "pending_review",
      subject: "Test subject",
      to: ["x@example.com"],
    });

    expect(created.id).toMatch(/^mock-draft-/);
    expect(created.createdAt).toBeTruthy();
    const after = await repo.list();
    expect(after.length).toBe(before + 1);
  });

  it("updates draft fields and returns the new record", async () => {
    const repo = new MockEmailDraftRepository();
    const list = await repo.list();
    const target = list[0]!;

    const updated = await repo.update(target.id, { status: "failed", subject: "New subject" });
    expect(updated?.status).toBe("failed");
    expect(updated?.subject).toBe("New subject");
  });

  it("marks a draft as sent with an email log id", async () => {
    const repo = new MockEmailDraftRepository();
    const list = await repo.list();
    const target = list[0]!;

    const marked = await repo.markSent({ draftId: target.id, emailLogId: "log-1", lastError: null });
    expect(marked?.status).toBe("sent");
    expect(marked?.sentEmailLogId).toBe("log-1");
  });
});
