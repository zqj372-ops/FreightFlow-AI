import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRepositoryCache, getRepositories } from "@/lib/repositories";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("getRepositories factory", () => {
  beforeEach(() => {
    __resetRepositoryCache();
  });

  afterEach(() => {
    __resetRepositoryCache();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    vi.restoreAllMocks();
  });

  it("falls back to the mock bundle when DATABASE_URL is not configured", async () => {
    delete process.env.DATABASE_URL;
    const repos = await getRepositories();

    expect(repos.mode).toBe("mock");
    expect(repos.shipments).toBeDefined();
    expect(repos.contacts).toBeDefined();
    expect(repos.bookingPlans).toBeDefined();
    expect(repos.drafts).toBeDefined();
    expect(repos.emailMessages).toBeDefined();
    expect(repos.emailRecognitions).toBeDefined();
  });

  it("caches the bundle across calls", async () => {
    delete process.env.DATABASE_URL;
    const first = await getRepositories();
    const second = await getRepositories();

    expect(first.shipments).toBe(second.shipments);
    expect(first.contacts).toBe(second.contacts);
  });

  it("downgrades to mock when the prisma probe throws an unavailable error", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/x";
    const { prisma } = await import("@/lib/prisma");
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:5432"));

    const repos = await getRepositories();

    expect(spy).toHaveBeenCalled();
    expect(repos.mode).toBe("mock");
  });

  it("upgrades to prisma when the probe round trip succeeds", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/x";
    const { prisma } = await import("@/lib/prisma");
    const spy = vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }]);

    const repos = await getRepositories();

    expect(spy).toHaveBeenCalled();
    expect(repos.mode).toBe("prisma");
  });
});
