import type { ShipmentRecord, ShipmentStatus } from "@/lib/mock-data";

/**
 * Subset of the data needed to advance a Shipment's status / log.
 * Mirrors the action log payload used by the existing
 * `persistShipmentAction` helper in `@/lib/freightflow-data`.
 */
export type ShipmentActionLogInput = {
  actionType:
    | "订舱邮件"
    | "催单提醒"
    | "补料文件"
    | "SO 识别"
    | "AMS/ACI/ISF"
    | "异常标记";
  actorEmail?: string | null;
  actorName?: string | null;
  afterSnapshot?: ShipmentRecord | null;
  beforeSnapshot?: ShipmentRecord | null;
  shipmentId: string;
  source?: "AI" | "SYSTEM" | "UI";
  summary: string;
};

export type AdvanceStatusInput = {
  /**
   * Optional patch of the full shipment record. When provided, the patch
   * replaces the stored record (parity with the current
   * `shipmentUpdateData` helper which deletes + recreates nested rows).
   */
  patch?: Partial<ShipmentRecord>;
  shipmentId: string;
  status?: ShipmentStatus;
};

/**
 * Repository surface for the Shipment aggregate. The mock and prisma
 * adapters are interchangeable from the API layer's perspective.
 */
export interface ShipmentRepository {
  advanceStatus(input: AdvanceStatusInput): Promise<ShipmentRecord | null>;
  getById(id: string): Promise<ShipmentRecord | null>;
  list(): Promise<ShipmentRecord[]>;
  recordActionLog(input: ShipmentActionLogInput): Promise<void>;
}
