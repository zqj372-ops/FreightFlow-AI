import { describe, expect, it } from "vitest";

import { MockContactRepository } from "@/lib/repositories/mock";

describe("MockContactRepository", () => {
  it("returns the fallback contact list seeded from mock shipments", async () => {
    const repo = new MockContactRepository();
    const contacts = await repo.list();

    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts.every((c) => typeof c.email === "string" && c.email.length > 0)).toBe(true);
  });

  it("sorts the fallback list by email for stable UI rendering", async () => {
    const repo = new MockContactRepository();
    const contacts = await repo.list();
    const emails = contacts.map((c) => c.email);

    const sorted = [...emails].sort((a, b) => a.localeCompare(b));
    expect(emails).toEqual(sorted);
  });

  it("finds a contact by email case-insensitively", async () => {
    const repo = new MockContactRepository();
    const contacts = await repo.list();
    const target = contacts[0]!;

    const found = await repo.getByEmail(target.email.toUpperCase());
    expect(found?.email).toBe(target.email);
  });

  it("returns null when no contact matches the email", async () => {
    const repo = new MockContactRepository();
    const found = await repo.getByEmail("nobody@freightflow.ai");
    expect(found).toBeNull();
  });
});
