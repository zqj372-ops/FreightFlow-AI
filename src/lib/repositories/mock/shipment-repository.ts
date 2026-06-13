import type { ShipmentRecord } from "@/lib/mock-data";

import type {
  AdvanceStatusInput,
  ShipmentActionLogInput,
  ShipmentRepository,
} from "../shipment-repository";
import { getMockStore } from "./mock-store";

/**
 * The mock store keeps a parallel "action log" list. We keep it as a
 * `WeakMap` keyed by shipment id so the seed data doesn't need a
 * dedicated column.
 */
const actionLogs = new Map<string, ShipmentActionLogInput[]>();

function recordActionLog(input: ShipmentActionLogInput) {
  const list = actionLogs.get(input.shipmentId) ?? [];
  list.push(input);
  actionLogs.set(input.shipmentId, list);
}

function persistPatch(record: ShipmentRecord, patch: Partial<ShipmentRecord>) {
  const merged: ShipmentRecord = {
    ...record,
    ...patch,
    documentProgress: patch.documentProgress
      ? { ...record.documentProgress, ...patch.documentProgress }
      : record.documentProgress,
    exceptions: patch.exceptions ?? record.exceptions,
    reminderFlags: patch.reminderFlags ?? record.reminderFlags,
  };
  return merged;
}

export class MockShipmentRepository implements ShipmentRepository {
  async list() {
    return getMockStore().shipments.map((shipment) => structuredClone(shipment));
  }

  async getById(id: string) {
    const record = getMockStore().shipments.find((shipment) => shipment.id === id);
    return record ? structuredClone(record) : null;
  }

  async advanceStatus(input: AdvanceStatusInput) {
    const store = getMockStore();
    const index = store.shipments.findIndex((shipment) => shipment.id === input.shipmentId);

    if (index < 0) return null;

    const current = store.shipments[index];
    const next = input.patch ? persistPatch(current, input.patch) : current;
    if (input.status) {
      next.status = input.status;
    }
    store.shipments[index] = next;
    return structuredClone(next);
  }

  async recordActionLog(input: ShipmentActionLogInput) {
    recordActionLog(input);
  }
}

export function __getMockShipmentActionLogs(shipmentId: string) {
  return actionLogs.get(shipmentId) ?? [];
}
