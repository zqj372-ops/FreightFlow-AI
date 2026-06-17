import { buildBookingPlanRecord } from "@/features/freightflow/booking-plan-rules";

import type {
  BookingPlanRecord,
  BookingPlanRepository,
  UpdatePlanStatusInput,
  UpsertBookingPlanInput,
} from "../booking-plan-repository";
import { getMockStore } from "./mock-store";

function toRecord(plan: BookingPlanRecord): BookingPlanRecord {
  return { ...plan, missingFields: [...plan.missingFields], riskFlags: [...plan.riskFlags] };
}

function toStoredRecord(input: UpsertBookingPlanInput, fallback: BookingPlanRecord): BookingPlanRecord {
  return {
    ...fallback,
    batchNo: input.batchNo,
    bookingAgent: input.bookingAgent,
    containerType: input.containerType,
    destinationPort: input.destinationPort,
    id: input.id ?? fallback.id,
    lastDraftId: fallback.lastDraftId,
    lastError: input.lastError ?? null,
    missingFields: [...input.snapshot.missingFields],
    originPort: input.originPort,
    planStatus: input.planStatus,
    preferredBookingAgent: input.preferredBookingAgent ?? null,
    riskFlags: [...input.snapshot.riskFlags],
    shipmentId: input.shipmentId,
  };
}

export class MockBookingPlanRepository implements BookingPlanRepository {
  async list() {
    return getMockStore().bookings.map(toRecord);
  }

  async getByShipmentId(shipmentId: string) {
    const plan = getMockStore().bookings.find((entry) => entry.shipmentId === shipmentId);
    return plan ? toRecord(plan) : null;
  }

  async upsertForShipment(input: UpsertBookingPlanInput) {
    const store = getMockStore();
    const existing = store.bookings.find((entry) => entry.shipmentId === input.shipmentId);

    if (existing) {
      const next = toStoredRecord(input, existing);
      store.bookings = store.bookings.map((entry) => (entry.shipmentId === input.shipmentId ? next : entry));
      return toRecord(next);
    }

    const shipment = store.shipments.find((entry) => entry.id === input.shipmentId);
    if (!shipment) {
      throw new Error(`Shipment ${input.shipmentId} not found while upserting booking plan.`);
    }
    const built = buildBookingPlanRecord(shipment, { planStatus: input.planStatus });
    const baseline: BookingPlanRecord = { ...built, preferredBookingAgent: built.bookingAgent || null };
    const created = toStoredRecord(input, baseline);
    store.bookings.push(created);
    return toRecord(created);
  }

  async updateStatus(input: UpdatePlanStatusInput) {
    const store = getMockStore();
    const index = store.bookings.findIndex((entry) => entry.id === input.id);
    if (index < 0) return null;
    const current = store.bookings[index];
    const next: BookingPlanRecord = {
      ...current,
      lastDraftId: input.lastDraftId !== undefined ? input.lastDraftId : current.lastDraftId,
      lastError: input.lastError !== undefined ? input.lastError : current.lastError,
      planStatus: input.planStatus,
    };
    store.bookings[index] = next;
    return toRecord(next);
  }

  async bindLastDraft(planId: string, draftId: string | null) {
    const store = getMockStore();
    const index = store.bookings.findIndex((entry) => entry.id === planId);
    if (index < 0) return null;
    const next = { ...store.bookings[index], lastDraftId: draftId };
    store.bookings[index] = next;
    return toRecord(next);
  }
}
