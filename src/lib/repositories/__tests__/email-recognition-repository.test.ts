import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRepositoryCache, getRepositories, type RepositoryBundle } from "../index";
import { resetMockStore } from "../mock/mock-store";

describe("mock email message + recognition repositories", () => {
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

  it("seeds email messages with syncStatus=new", async () => {
    const messages = await repos.emailMessages.list();
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every((m) => m.syncStatus === "new")).toBe(true);
  });

  it("looks up an email message by its messageId", async () => {
    const found = await repos.emailMessages.getByMessageId("mock-so-released-001");
    expect(found?.subject).toContain("SO已出");
  });

  it("updates the sync status of an email message", async () => {
    const messages = await repos.emailMessages.list();
    const target = messages[0];
    const updated = await repos.emailMessages.updateSyncStatus({
      id: target.id,
      syncStatus: "confirmed",
    });
    expect(updated?.syncStatus).toBe("confirmed");
  });

  it("lists pending recognitions and joins the email message payload", async () => {
    const queue = await repos.emailRecognitions.listPending();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((item) => item.status === "pending_review")).toBe(true);
    expect(queue.every((item) => item.emailMessage.messageId.length > 0)).toBe(true);
  });

  it("transitions a recognition to confirmed status", async () => {
    const queue = await repos.emailRecognitions.listPending();
    const target = queue[0];
    const updated = await repos.emailRecognitions.updateStatus({
      id: target.id,
      reviewedBy: "王操作",
      status: "confirmed",
    });
    expect(updated?.status).toBe("confirmed");
    expect(updated?.reviewedBy).toBe("王操作");

    const remaining = await repos.emailRecognitions.listPending();
    expect(remaining.map((item) => item.id)).not.toContain(target.id);
  });
});
