import { ContactRole as DbContactRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ContactRepository, ContactWithMeta } from "../contact-repository";

const roleToDb: Record<ContactWithMeta["role"], DbContactRole> = {
  booking_agent: DbContactRole.BOOKING_AGENT,
  customs: DbContactRole.CUSTOMS,
  ops: DbContactRole.OPS,
  sales: DbContactRole.SALES,
};

const dbRoleToUi: Record<DbContactRole, ContactWithMeta["role"]> = {
  [DbContactRole.BOOKING_AGENT]: "booking_agent",
  [DbContactRole.CUSTOMS]: "customs",
  [DbContactRole.OPS]: "ops",
  [DbContactRole.SALES]: "sales",
};

function toRecord(record: {
  email: string;
  id: string;
  isActive: boolean;
  label: string;
  role: DbContactRole;
}): ContactWithMeta {
  return {
    email: record.email,
    id: record.id,
    isActive: record.isActive,
    label: record.label,
    role: dbRoleToUi[record.role],
  };
}

export class PrismaContactRepository implements ContactRepository {
  async list(): Promise<ContactWithMeta[]> {
    const records = await prisma.contact.findMany({ orderBy: { email: "asc" } });
    return records.map(toRecord);
  }

  async getByEmail(email: string): Promise<ContactWithMeta | null> {
    const record = await prisma.contact.findUnique({ where: { email: email.trim().toLowerCase() } });
    return record ? toRecord(record) : null;
  }

  /**
   * Helper used by tests / future API routes. Not part of the public
   * `ContactRepository` interface.
   */
  static toPrismaRole(role: ContactWithMeta["role"]) {
    return roleToDb[role];
  }
}
