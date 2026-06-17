import { getFallbackContacts } from "@/lib/freightflow-data";

import type { ContactRepository, ContactWithMeta } from "../contact-repository";

const fallback = getFallbackContacts();

export class MockContactRepository implements ContactRepository {
  async list(): Promise<ContactWithMeta[]> {
    return fallback.map((contact) => ({ ...contact }));
  }

  async getByEmail(email: string): Promise<ContactWithMeta | null> {
    const target = email.trim().toLowerCase();
    const match = fallback.find((contact) => contact.email.toLowerCase() === target);
    return match ? { ...match } : null;
  }
}
