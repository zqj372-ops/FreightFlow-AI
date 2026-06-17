import type { ContactRecord, ContactRole } from "@/features/freightflow/page-helpers";

export type ContactWithMeta = ContactRecord & {
  id?: string;
  isActive?: boolean;
};

export interface ContactRepository {
  list(): Promise<ContactWithMeta[]>;
  getByEmail(email: string): Promise<ContactWithMeta | null>;
}

/**
 * Re-exported here so consumers only need to import from the repository
 * barrel when they want both `ContactRecord` and the contact role enum.
 */
export type { ContactRecord, ContactRole };
