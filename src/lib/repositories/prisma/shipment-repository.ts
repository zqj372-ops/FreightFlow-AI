import { ActionSource as DbActionSource, Prisma, ShipmentActionType as DbShipmentActionType } from "@prisma/client";

import {
  formatDateForUi,
  shipmentUpdateData,
  toShipmentRecord,
  type ShipmentWithRelations,
} from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";
import type { ShipmentRecord } from "@/lib/mock-data";

import type {
  AdvanceStatusInput,
  ShipmentActionLogInput,
  ShipmentRepository,
} from "../shipment-repository";

const shipmentInclude = {
  documentProgress: true,
  exceptions: { orderBy: { sortOrder: "asc" as const } },
  reminderFlags: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ShipmentInclude;

const actionTypeToDb: Record<ShipmentActionLogInput["actionType"], DbShipmentActionType> = {
  订舱邮件: DbShipmentActionType.BOOKING_EMAIL,
  催单提醒: DbShipmentActionType.FOLLOW_UP,
  补料文件: DbShipmentActionType.DOCUMENTS,
  "SO 识别": DbShipmentActionType.SO_RECOGNITION,
  "AMS/ACI/ISF": DbShipmentActionType.CUSTOMS_PROGRESS,
  异常标记: DbShipmentActionType.EXCEPTION_MARK,
};

const actionSourceToDb: Record<NonNullable<ShipmentActionLogInput["source"]>, DbActionSource> = {
  AI: DbActionSource.AI,
  SYSTEM: DbActionSource.SYSTEM,
  UI: DbActionSource.UI,
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return formatDateForUi(value);
  return value;
}

function stripDates(record: ShipmentRecord): ShipmentRecord {
  return {
    ...record,
    etd: toIso(record.etd),
    eta: toIso(record.eta),
    cutoffTime: toIso(record.cutoffTime),
    lastEmailTime: toIso(record.lastEmailTime),
  };
}

function patchToRecord(base: ShipmentRecord, patch: Partial<ShipmentRecord>): ShipmentRecord {
  return stripDates({ ...base, ...patch });
}

export class PrismaShipmentRepository implements ShipmentRepository {
  async list(): Promise<ShipmentRecord[]> {
    const records = await prisma.shipment.findMany({
      include: shipmentInclude,
      orderBy: [{ etd: "asc" }, { id: "asc" }],
    });
    return records.map((record) => toShipmentRecord(record as ShipmentWithRelations));
  }

  async getById(id: string): Promise<ShipmentRecord | null> {
    const record = await prisma.shipment.findUnique({
      include: shipmentInclude,
      where: { id },
    });
    return record ? toShipmentRecord(record as ShipmentWithRelations) : null;
  }

  async advanceStatus(input: AdvanceStatusInput): Promise<ShipmentRecord | null> {
    const current = await prisma.shipment.findUnique({
      include: shipmentInclude,
      where: { id: input.shipmentId },
    });
    if (!current) return null;

    const baseRecord = toShipmentRecord(current as ShipmentWithRelations);
    const merged = input.patch
      ? patchToRecord(baseRecord, input.patch)
      : { ...baseRecord, ...(input.status ? { status: input.status } : {}) };

    const updated = await prisma.shipment.update({
      data: shipmentUpdateData(merged),
      include: shipmentInclude,
      where: { id: input.shipmentId },
    });
    return toShipmentRecord(updated as ShipmentWithRelations);
  }

  async recordActionLog(input: ShipmentActionLogInput): Promise<void> {
    await prisma.shipmentActionLog.create({
      data: {
        actionType: actionTypeToDb[input.actionType],
        actorEmail: input.actorEmail?.trim() || null,
        actorName: input.actorName?.trim() || null,
        afterSnapshot: input.afterSnapshot
          ? (input.afterSnapshot as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        beforeSnapshot: input.beforeSnapshot
          ? (input.beforeSnapshot as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shipmentId: input.shipmentId,
        source: input.source ? actionSourceToDb[input.source] : DbActionSource.UI,
        summary: input.summary,
      },
    });
  }
}
