import type { ContactRecord, ContactRole } from "@/features/freightflow/page-helpers";
import { mockShipments } from "@/lib/freightflow-data";

import type { ContactRepository, ContactWithMeta } from "../contact-repository";

function seedFallbackContacts(): ContactWithMeta[] {
  const contacts = new Map<string, ContactWithMeta>();
  const addContact = (contact: ContactWithMeta) => {
    contacts.set(contact.email.toLowerCase(), contact);
  };

  for (const shipment of mockShipments) {
    addContact({
      email: `${shipment.bookingAgent.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`,
      isActive: true,
      label: `${shipment.bookingAgent} booking desk`,
      role: "booking_agent" satisfies ContactRole,
    });
    addContact({
      email: `${shipment.operator.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`,
      isActive: true,
      label: `${shipment.operator} operator`,
      role: "ops" satisfies ContactRole,
    });
  }

  addContact({ email: "ops@freightflow.ai", isActive: true, label: "FreightFlow operations", role: "ops" });
  addContact({ email: "sales@freightflow.ai", isActive: true, label: "Sales owner", role: "sales" });
  addContact({ email: "customs.docs@freightflow.ai", isActive: true, label: "Customs documents", role: "customs" });

  return Array.from(contacts.values()).sort((a, b) => a.email.localeCompare(b.email));
}

export class MockContactRepository implements ContactRepository {
  async list(): Promise<ContactWithMeta[]> {
    return seedFallbackContacts();
  }

  async getByEmail(email: string): Promise<ContactWithMeta | null> {
    const target = email.trim().toLowerCase();
    return seedFallbackContacts().find((c) => c.email.toLowerCase() === target) ?? null;
  }
}

/**
 * Re-exported here so the mock surface mirrors the prisma adapter and
 * routes can import `ContactRecord` from either.
 */
export type { ContactRecord, ContactRole };
