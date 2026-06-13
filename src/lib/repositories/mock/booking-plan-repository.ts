import type {
  BookingPlanRecord,
  BookingPlanRepository,
  UpdatePlanStatusInput,
  UpsertBookingPlanInput,
} from "../booking-plan-repository";
import { getMockStore } from "./mock-store";

function nowIso() {
  return new Date().toISOString();
}

function deriveMissingFields(snapshot: UpsertBookingPlanInput["snapshot"]): string[] {
  return [...snapshot.missingFields];
}

function deriveRiskFlags(snapshot: UpsertBookingPlanInput["snapshot"]): string[] {
  return [...snapshot.riskFlags];
}

function buildRecord(input: UpsertBookingPlanInput, id: string): BookingPlanRecord {
  return {
    batchNo: input.batchNo,
    bookingAgent: input.bookingAgent,
    containerType: input.containerType,
    destinationPort: input.destinationPort,
    id,
    lastDraftId: null,
    lastError: input.lastError ?? null,
    missingFields: deriveMissingFields(input.snapshot),
    originPort: input.originPort,
    planStatus: input.planStatus,
    preferredBookingAgent: input.preferredBookingAgent ?? null,
    riskFlags: deriveRiskFlags(input.snapshot),
    shipmentId: input.shipmentId,
  };
}

export class MockBookingPlanRepository implements BookingPlanRepository {
  async list(): Promise<BookingPlanRecord[]> {
    return getMockStore().bookings.map((plan) => structuredClone(plan));
  }

  async getByShipmentId(shipmentId: string): Promise<BookingPlanRecord | null> {
    const found = getMockStore().bookings.find((p) => p.shipmentId === shipmentId);
    return found ? structuredClone(found) : null;
  }

  async upsertForShipment(input: UpsertBookingPlanInput): Promise<BookingPlanRecord> {
    const store = getMockStore();
    const existing = store.bookings.find((p) => p.shipmentId === input.shipmentId);
    if (existing) {
      const next: BookingPlanRecord = {
        ...existing,
        ...buildRecord(input, existing.id),
        lastDraftId: existing.lastDraftId,
      };
      store.bookings = store.bookings.map((p) => (p.id === existing.id ? next : p));
      return structuredClone(next);
    }

    const id = input.id ?? `mock-plan-${store.bookings.length + 1}`;
    const next = buildRecord(input, id);
    store.bookings.push(next);
    return structuredClone(next);
  }

  async updateStatus(input: UpdatePlanStatusInput): Promise<BookingPlanRecord | null> {
    const store = getMockStore();
    const index = store.bookings.findIndex((p) => p.id === input.id);
    if (index === -1) return null;

    const current = store.bookings[index]!;
    const next: BookingPlanRecord = {
      ...current,
      lastDraftId: input.lastDraftId === undefined ? current.lastDraftId : input.lastDraftId,
      lastError: input.lastError === undefined ? current.lastError : input.lastError,
      planStatus: input.planStatus,
      updatedAt: nowIso(),
    } as BookingPlanRecord;
    store.bookings[index] = next;
    return structuredClone(next);
  }

  async bindLastDraft(planId: string, draftId: string | null): Promise<BookingPlanRecord | null> {
    const store = getMockStore();
    const index = store.bookings.findIndex((p) => p.id === planId);
    if (index === -1) return null;

    const current = store.bookings[index]!;
    const next: BookingPlanRecord = {
      ...current,
      lastDraftId: draftId,
      updatedAt: nowIso(),
    } as BookingPlanRecord;
    store.bookings[index] = next;
    return structuredClone(next);
  }
}
