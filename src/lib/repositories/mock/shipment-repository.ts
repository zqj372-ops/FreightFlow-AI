import type { ShipmentRecord } from "@/lib/mock-data";

import type {
  AdvanceStatusInput,
  ShipmentActionLogInput,
  ShipmentRepository,
} from "../shipment-repository";
import { getMockStore } from "./mock-store";

function nowIso() {
  return new Date().toISOString();
}

export class MockShipmentRepository implements ShipmentRepository {
  async list(): Promise<ShipmentRecord[]> {
    return getMockStore().shipments.map((shipment) => structuredClone(shipment));
  }

  async getById(id: string): Promise<ShipmentRecord | null> {
    const found = getMockStore().shipments.find((s) => s.id === id);
    return found ? structuredClone(found) : null;
  }

  async advanceStatus(input: AdvanceStatusInput): Promise<ShipmentRecord | null> {
    const store = getMockStore();
    const index = store.shipments.findIndex((s) => s.id === input.shipmentId);
    if (index === -1) return null;

    const current = store.shipments[index]!;
    const next: ShipmentRecord = {
      ...current,
      ...(input.patch ?? {}),
      ...(input.status ? { status: input.status } : {}),
    };
    store.shipments[index] = next;
    return structuredClone(next);
  }

  async recordActionLog(input: ShipmentActionLogInput): Promise<void> {
    // Mock adapter keeps the action log alongside the shipment as a
    // reminder flag so the workbench surfaces it without hitting the DB.
    const store = getMockStore();
    const shipment = store.shipments.find((s) => s.id === input.shipmentId);
    if (!shipment) return;

    shipment.reminderFlags = [
      `[${input.actionType}] ${input.summary}`,
      ...shipment.reminderFlags,
    ];
    shipment.lastEmailTime = nowIso();
  }
}
