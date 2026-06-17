import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRepositoryCache, getRepositories, type RepositoryBundle } from "../index";
import { resetMockStore } from "../mock/mock-store";

describe("mock email draft repository", () => {
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

  it("seeds drafts in pending_review status", async () => {
    const drafts = await repos.drafts.list();
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((draft) => draft.status === "pending_review")).toBe(true);
  });

  it("creates a new draft and assigns an id", async () => {
    const created = await repos.drafts.create({
      attachmentName: "FF-TEST-托书.docx",
      body: "请协助订舱。",
      cc: ["ops@freightflow.ai"],
      createdFromPlanId: null,
      draftType: "booking",
      shipmentId: "SHP-240610-006",
      status: "draft",
      subject: "FF-TEST 订舱",
      to: ["agent@example.com"],
    });

    expect(created.id).toBeTruthy();
    expect(created.shipmentId).toBe("SHP-240610-006");
    expect(created.status).toBe("draft");

    const fetched = await repos.drafts.getById(created.id);
    expect(fetched?.id).toBe(created.id);
  });

  it("updates draft fields in place", async () => {
    const drafts = await repos.drafts.list();
    const target = drafts[0];
    const updated = await repos.drafts.update(target.id, {
      body: "新的正文",
      subject: "新主题",
    });
    expect(updated?.body).toBe("新的正文");
    expect(updated?.subject).toBe("新主题");
    expect(updated?.id).toBe(target.id);
    expect(updated?.status).toBe(target.status);
  });

  it("marks a draft as sent with the persisted email log id", async () => {
    const drafts = await repos.drafts.list();
    const target = drafts[0];
    const sent = await repos.drafts.markSent({
      draftId: target.id,
      emailLogId: "log-abc",
      lastError: null,
    });
    expect(sent?.status).toBe("sent");
    expect(sent?.sentEmailLogId).toBe("log-abc");
    expect(sent?.lastError).toBeNull();
  });

  it("returns null when getting an unknown draft id", async () => {
    const fetched = await repos.drafts.getById("does-not-exist");
    expect(fetched).toBeNull();
  });
});
