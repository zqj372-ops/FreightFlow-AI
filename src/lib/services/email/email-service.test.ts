import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { EmailMessageSyncStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readEmailConfig } from "@/lib/email-config";
import { prisma } from "@/lib/prisma";

import {
  drainInMemorySyncFailures,
  runSync,
} from "./email-service";
import type {
  EmailMessageFull,
  EmailMessageMetadata,
  EmailPullProvider,
  EmailSearchOptions,
} from "./types";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email-config", () => ({
  readEmailConfig: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  Test helpers — typed wrappers over the prisma mock to keep the test       */
/*  bodies free of `as any` noise while still satisfying strict-TS mocks.     */
/* -------------------------------------------------------------------------- */

type MockEmailMessageClient = {
  create: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const prismaMock = (): MockEmailMessageClient =>
  prisma.emailMessage as unknown as MockEmailMessageClient;

function setFindFirst(value: unknown) {
  prismaMock().findFirst.mockResolvedValue(value);
}

function setFindUniqueByMessageId(value: (messageId: string) => unknown) {
  prismaMock().findUnique.mockImplementation(async ({ where }: { where: { messageId: string } }) =>
    value(where.messageId),
  );
}

function setCreate(impl: (data: Record<string, unknown>) => unknown) {
  prismaMock().create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => impl(data));
}

function setCreateSequence(impls: Array<(data: Record<string, unknown>) => unknown>) {
  let i = 0;
  setCreate((data) => {
    const fn = impls[Math.min(i, impls.length - 1)];
    i += 1;
    return fn(data);
  });
}

function setUpdate(value: unknown) {
  prismaMock().update.mockResolvedValue(value);
}

function makePrismaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "email-1",
    messageId: "msg-001",
    subject: "stub",
    ...overrides,
  };
}

type StubProviderOptions = {
  failSearch?: boolean;
  failFetchFor?: Set<string>;
};

function makeStubProvider(
  options: StubProviderOptions = {},
): EmailPullProvider & { searchCalls: EmailSearchOptions[]; fetchCalls: EmailMessageMetadata[] } {
  const messages: EmailMessageFull[] = [
    {
      attachments: [],
      bodyText: "SO已出，SO: OOLU8791320",
      cc: [],
      from: "seabay@freightflow.ai",
      mailbox: "INBOX",
      messageId: "msg-001",
      provider: "stub",
      receivedAt: new Date("2026-06-13T08:00:00.000Z"),
      subject: "FF-CA-240610-A01 SO已出",
      threadId: "thread-001",
      to: ["ops@freightflow.ai"],
    },
    {
      attachments: [],
      bodyText: "SI Confirmed for COSU5519028",
      cc: ["ops@freightflow.ai"],
      from: "apex@freightflow.ai",
      mailbox: "INBOX",
      messageId: "msg-002",
      provider: "stub",
      receivedAt: new Date("2026-06-13T08:15:00.000Z"),
      subject: "FF-US-240610-B03 SI Confirmed",
      threadId: "thread-002",
      to: ["ops@freightflow.ai"],
    },
    {
      attachments: [],
      bodyText: "柜型不符，请确认",
      cc: [],
      from: "anchor@freightflow.ai",
      mailbox: "INBOX",
      messageId: "msg-003",
      provider: "stub",
      receivedAt: new Date("2026-06-13T08:30:00.000Z"),
      subject: "FF-CA-240610-E15 柜型不符",
      threadId: "thread-003",
      to: ["ops@freightflow.ai"],
    },
  ];

  const provider: EmailPullProvider & {
    searchCalls: EmailSearchOptions[];
    fetchCalls: EmailMessageMetadata[];
  } = {
    fetchCalls: [],
    name: "stub-pull",
    searchCalls: [],

    async fetchFull(metadata: EmailMessageMetadata) {
      this.fetchCalls.push(metadata);
      if (options.failFetchFor?.has(metadata.messageId)) {
        throw new Error(`simulated transport error for ${metadata.messageId}`);
      }
      const found = messages.find((item) => item.messageId === metadata.messageId);
      if (!found) throw new Error(`stub: unknown messageId ${metadata.messageId}`);
      return { ...found };
    },

    async search(searchOptions: EmailSearchOptions) {
      this.searchCalls.push(searchOptions);
      if (options.failSearch) {
        throw new Error("simulated search failure");
      }
      const mailbox = searchOptions.mailbox ?? "INBOX";
      const since = searchOptions.since ?? null;
      const limit = searchOptions.limit ?? 100;
      return messages
        .filter((item) => item.mailbox === mailbox)
        .filter((item) => (since ? item.receivedAt > since : true))
        .slice(0, limit)
        .map((item) => ({
          attachments: item.attachments,
          cc: item.cc,
          from: item.from,
          mailbox: item.mailbox,
          messageId: item.messageId,
          receivedAt: item.receivedAt,
          subject: item.subject,
          threadId: item.threadId,
          to: item.to,
        }));
    },
  };

  return provider;
}

function mockNoEmailConfig() {
  vi.mocked(readEmailConfig).mockResolvedValue({
    enabled: false,
    fromEmail: "",
    fromName: "",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    password: "",
    replyTo: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    updatedAt: null,
    username: "",
  });
}

function mockImapEmailConfig() {
  vi.mocked(readEmailConfig).mockResolvedValue({
    enabled: true,
    fromEmail: "ops@freightflow.ai",
    fromName: "FreightFlow AI",
    imapHost: "imap.example.com",
    imapPort: 993,
    imapSecure: true,
    password: "secret",
    replyTo: "",
    smtpHost: "smtp.example.com",
    smtpPort: 465,
    smtpSecure: true,
    updatedAt: null,
    username: "ops@freightflow.ai",
  });
}

let tempConfigDir: string | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  drainInMemorySyncFailures();
  tempConfigDir = mkdtempSync(path.join(tmpdir(), "ff-email-config-"));
  vi.spyOn(process, "cwd").mockReturnValue(tempConfigDir);
});

afterEach(() => {
  if (tempConfigDir) {
    rmSync(tempConfigDir, { recursive: true, force: true });
    tempConfigDir = null;
  }
  vi.restoreAllMocks();
});

describe("runSync — mock provider happy path", () => {
  it("persists 3 new messages and reports the correct counts", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreate((data) => makePrismaRecord({ messageId: data.messageId }));
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider });

    expect(report.provider).toBe("stub-pull");
    expect(report.scanned).toBe(3);
    expect(report.fetched).toBe(3);
    expect(report.newInserted).toBe(3);
    expect(report.duplicatesSkipped).toBe(0);
    expect(report.errorCount).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.startedAt).toMatch(/T/);

    expect(prismaMock().create).toHaveBeenCalledTimes(3);
    const firstCreate = prismaMock().create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(firstCreate.data).toMatchObject({
      from: "seabay@freightflow.ai",
      mailbox: "INBOX",
      messageId: "msg-001",
      syncStatus: EmailMessageSyncStatus.NEW,
    });

    expect(prismaMock().update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { syncStatus: EmailMessageSyncStatus.PARSED },
    });
  });
});

describe("runSync — dedupe", () => {
  it("skips messages whose messageId already exists in the database", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();

    setFindFirst(null);
    setFindUniqueByMessageId((messageId) =>
      messageId === "msg-002" ? makePrismaRecord({ messageId: "msg-002" }) : null,
    );
    setCreate((data) => makePrismaRecord({ messageId: data.messageId }));
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider });

    expect(report.scanned).toBe(3);
    expect(report.fetched).toBe(3);
    expect(report.newInserted).toBe(2);
    expect(report.duplicatesSkipped).toBe(1);
    expect(prismaMock().create).toHaveBeenCalledTimes(2);
  });

  it("treats unique-constraint errors during insert as duplicates and keeps going", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreateSequence([
      (data) => makePrismaRecord({ messageId: data.messageId }),
      () => {
        const err = new Error("Unique constraint failed on the fields: (`messageId`)") as Error & { code?: string };
        err.code = "P2002";
        throw err;
      },
      (data) => makePrismaRecord({ messageId: data.messageId }),
    ]);
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider });

    expect(report.newInserted).toBe(2);
    expect(report.duplicatesSkipped).toBe(1);
    expect(report.errorCount).toBe(0);
  });
});

describe("runSync — provider error handling", () => {
  it("captures search failures in errors[] and returns a partial report", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider({ failSearch: true });

    const report = await runSync({}, { provider });

    expect(report.provider).toBe("stub-pull");
    expect(report.scanned).toBe(0);
    expect(report.fetched).toBe(0);
    expect(report.newInserted).toBe(0);
    expect(report.errorCount).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({ code: "PROVIDER", stage: "search" });
  });

  it("captures per-message fetch failures without aborting the whole run", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider({ failFetchFor: new Set(["msg-002"]) });

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreate((data) => makePrismaRecord({ messageId: data.messageId }));
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider });

    expect(report.scanned).toBe(3);
    expect(report.fetched).toBe(2);
    expect(report.newInserted).toBe(2);
    expect(report.duplicatesSkipped).toBe(0);
    expect(report.errorCount).toBe(1);
    expect(report.errors[0]).toMatchObject({
      code: "FETCH",
      messageId: "msg-002",
      stage: "fetch",
    });
  });

  it("records in-memory sync failures when persist throws a non-duplicate error", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreate(() => {
      throw new Error("disk full");
    });
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider });

    expect(report.errorCount).toBeGreaterThanOrEqual(1);
    const failures = drainInMemorySyncFailures();
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].errorMessage).toContain("DB column missing");
  });
});

describe("runSync — syncStatus state machine", () => {
  it("transitions NEW → PARSED via the downstream trigger", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();
    const trigger = vi.fn().mockResolvedValue(undefined);

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreate((data) => makePrismaRecord({ messageId: data.messageId }));
    setUpdate(makePrismaRecord());

    await runSync({}, { provider, triggerRecognition: trigger });

    expect(trigger).toHaveBeenCalledTimes(3);
    expect(trigger).toHaveBeenNthCalledWith(1, "email-1");
  });

  it("captures recognition errors in errors[] but does not revert persistence", async () => {
    mockNoEmailConfig();
    const provider = makeStubProvider();
    const trigger = vi.fn().mockRejectedValue(new Error("classifier offline"));

    setFindFirst(null);
    setFindUniqueByMessageId(() => null);
    setCreate((data) => makePrismaRecord({ messageId: data.messageId }));
    setUpdate(makePrismaRecord());

    const report = await runSync({}, { provider, triggerRecognition: trigger });

    expect(report.newInserted).toBe(3);
    expect(report.errorCount).toBe(3);
    expect(report.errors.every((err) => err.stage === "recognize" && err.code === "RECOGNITION")).toBe(true);
  });
});

describe("createPullProvider — config fallback", () => {
  it("uses the mock provider when no config file is present", async () => {
    mockNoEmailConfig();
    const { createPullProvider } = await import("./email-service");
    const provider = await createPullProvider();
    expect(provider.name).toBe("mock-pull");
  });

  it("uses the IMAP provider when the config has a usable IMAP host", async () => {
    mockImapEmailConfig();
    const { createPullProvider } = await import("./email-service");
    const provider = await createPullProvider();
    expect(provider.name).toBe("imap");
  });
});
