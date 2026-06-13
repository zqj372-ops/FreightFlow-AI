import { describe, expect, it } from "vitest";

import { getFallbackContacts } from "@/lib/freightflow-data";

import { MockContactRepository } from "../mock/contact-repository";

describe("mock contact repository", () => {
  const repo = new MockContactRepository();
  const fallback = getFallbackContacts();

  it("mirrors the fallback contact list from freightflow-data", async () => {
    const list = await repo.list();
    expect(list).toHaveLength(fallback.length);
    expect(list[0]).toMatchObject({
      email: fallback[0].email,
      label: fallback[0].label,
      role: fallback[0].role,
    });
  });

  it("looks up a contact by case-insensitive email", async () => {
    const sample = fallback[0];
    const found = await repo.getByEmail(sample.email.toUpperCase());
    expect(found?.email).toBe(sample.email);
  });

  it("returns null for unknown emails", async () => {
    const found = await repo.getByEmail("nobody@example.com");
    expect(found).toBeNull();
  });
});
