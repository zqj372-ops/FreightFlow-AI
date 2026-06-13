import { ContactRole as DbContactRole } from "@prisma/client";

import { isPrismaUnavailable, toContactRecord } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type {
  ContactRecord,
  ContactRepository,
  ContactRole,
  ContactWithMeta,
} from "../contact-repository";

const contactRoleToDb: Record<ContactRole, DbContactRole> = {
  booking_agent: DbContactRole.BOOKING_AGENT,
  customs: DbContactRole.CUSTOMS,
  ops: DbContactRole.OPS,
  sales: DbContactRole.SALES,
};

export class PrismaContactRepository implements ContactRepository {
  async list(): Promise<ContactWithMeta[]> {
    try {
      const records = await prisma.contact.findMany({ orderBy: { email: "asc" } });
      return records.map(toContactRecord);
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getByEmail(email: string): Promise<ContactWithMeta | null> {
    const target = email.trim().toLowerCase();
    try {
      const record = await prisma.contact.findUnique({ where: { email: target } });
      return record ? toContactRecord(record) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }
}

/**
 * Re-exported here so the prisma adapter exposes the same types as the
 * mock adapter and routes can use a single import path.
 */
export type { ContactRecord, ContactRole };
export { contactRoleToDb };
