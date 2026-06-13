import type { BookingPlanStatus } from "./types";

/**
 * Snapshot persisted on `BookingPlan.requiredFieldsSnapshot`. Mirrors the
 * shape used by the existing service layer.
 */
export type BookingPlanSnapshot = {
  missingFields: string[];
  riskFlags: string[];
};

export type BookingPlanRecord = {
  batchNo: string;
  bookingAgent: string;
  containerType: string;
  destinationPort: string;
  id: string;
  lastDraftId: string | null;
  lastError: string | null;
  missingFields: string[];
  originPort: string;
  planStatus: BookingPlanStatus;
  preferredBookingAgent: string | null;
  riskFlags: string[];
  shipmentId: string;
};

export type UpsertBookingPlanInput = {
  batchNo: string;
  bookingAgent: string;
  containerType: string;
  destinationPort: string;
  id?: string;
  lastError?: string | null;
  originPort: string;
  planStatus: BookingPlanStatus;
  preferredBookingAgent?: string | null;
  shipmentId: string;
  snapshot: BookingPlanSnapshot;
};

export type UpdatePlanStatusInput = {
  id: string;
  lastDraftId?: string | null;
  lastError?: string | null;
  planStatus: BookingPlanStatus;
};

export interface BookingPlanRepository {
  bindLastDraft(planId: string, draftId: string | null): Promise<BookingPlanRecord | null>;
  getByShipmentId(shipmentId: string): Promise<BookingPlanRecord | null>;
  list(): Promise<BookingPlanRecord[]>;
  updateStatus(input: UpdatePlanStatusInput): Promise<BookingPlanRecord | null>;
  upsertForShipment(input: UpsertBookingPlanInput): Promise<BookingPlanRecord>;
}
