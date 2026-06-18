import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shipments } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import {
  __resetRepositoryCache,
  getRepositories,
  type RepositoryBundle,
  type RepositoryMode,
} from "../index";
import { resetMockStore } from "../mock/mock-store";

describe("repository factory", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    __resetRepositoryCache();
    resetMockStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    __resetRepositoryCache();
  });

  it("returns the mock bundle when DATABASE_URL is not configured", async () => {
    delete process.env.DATABASE_URL;
    const repos = await getRepositories();
    expect(repos.mode).toBe<RepositoryMode>("mock");
    expect(repos.shipments.constructor.name).toBe("MockShipmentRepository");
  });

  it("returns a stable bundle on repeat calls", async () => {
    delete process.env.DATABASE_URL;
    const first = await getRepositories();
    const second = await getRepositories();
    expect(first).toBe(second);
  });

  it("seeds the mock store with the canonical shipment list", async () => {
    delete process.env.DATABASE_URL;
    const repos = await getRepositories();
    const list = await repos.shipments.list();
    expect(list).toHaveLength(shipments.length);
    expect(list.map((record) => record.id)).toEqual(shipments.map((record) => record.id));
  });

  it("treats an unreachable DATABASE_URL as a mock fallback", async () => {
    // Force the probe failure. The shared Prisma client may already be
    // initialized from the real local .env before this test mutates env vars.
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/postgres?schema=public";
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Can't reach database server at 127.0.0.1:1"));

    const repos = await getRepositories();
    expect(repos.mode).toBe<RepositoryMode>("mock");
  });

  it("exposes the same bundle shape regardless of mode", async () => {
    delete process.env.DATABASE_URL;
    const repos = await getRepositories();
    expectShape(repos);
  });
});

function expectShape(repos: RepositoryBundle) {
  for (const key of [
    "shipments",
    "bookingPlans",
    "drafts",
    "emailMessages",
    "contacts",
  ] as const) {
    expect(repos[key]).toBeDefined();
    expect(typeof repos[key].list).toBe("function");
  }
  expect(typeof repos.emailRecognitions.listPending).toBe("function");
}
