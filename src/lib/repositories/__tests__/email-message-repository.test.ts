import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MockEmailMessageRepository,
  resetMockStore,
  setMockStore,
} from "@/lib/repositories/mock";

describe("MockEmailMessageRepository", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    setMockStore(null);
  });

  it("lists seeded messages sorted by receivedAt desc", async () => {
    const repo = new MockEmailMessageRepository();
    const list = await repo.list();
    expect(list.length).toBeGreaterThan(0);
    const timestamps = list.map((m) => m.receivedAt);
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });

  it("finds a message by id and by messageId", async () => {
    const repo = new MockEmailMessageRepository();
    const list = await repo.list();
    const target = list[0]!;

    const byId = await repo.getById(target.id);
    const byMessageId = await repo.getByMessageId(target.messageId);
    expect(byId?.id).toBe(target.id);
    expect(byMessageId?.id).toBe(target.id);
  });

  it("creates a new message with a generated id", async () => {
    const repo = new MockEmailMessageRepository();
    const created = await repo.create({
      attachments: [],
      bodySummary: "",
      bodyText: "Test body",
      cc: [],
      from: "x@example.com",
      mailbox: "INBOX",
      messageId: "new-msg-1",
      receivedAt: "2026-06-13T09:00:00.000Z",
      subject: "New",
      syncStatus: "new",
      threadId: null,
      to: [],
    });

    expect(created.id).toMatch(/^mock-email-/);
    const found = await repo.getByMessageId("new-msg-1");
    expect(found?.id).toBe(created.id);
  });

  it("updates the sync status of a message", async () => {
    const repo = new MockEmailMessageRepository();
    const list = await repo.list();
    const target = list[0]!;

    const updated = await repo.updateSyncStatus({ id: target.id, syncStatus: "parsed" });
    expect(updated?.syncStatus).toBe("parsed");
  });
});
