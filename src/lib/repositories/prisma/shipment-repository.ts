import {
  Prisma,
  ShipmentActionType as DbShipmentActionType,
  ShipmentStatus as DbShipmentStatus,
  ActionSource as DbActionSource,
} from "@prisma/client";

import { isPrismaUnavailable, shipmentInclude, toShipmentRecord, shipmentUpdateData } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

import type {
  AdvanceStatusInput,
  ShipmentActionLogInput,
  ShipmentRepository,
} from "../shipment-repository";

const actionTypeToDb: Record<ShipmentActionLogInput["actionType"], DbShipmentActionType> = {
  订舱邮件: DbShipmentActionType.BOOKING_EMAIL,
  催单提醒: DbShipmentActionType.FOLLOW_UP,
  补料文件: DbShipmentActionType.DOCUMENTS,
  "SO 识别": DbShipmentActionType.SO_RECOGNITION,
  "AMS/ACI/ISF": DbShipmentActionType.CUSTOMS_PROGRESS,
  异常标记: DbShipmentActionType.EXCEPTION_MARK,
};

const sourceToDb: Record<NonNullable<ShipmentActionLogInput["source"]>, DbActionSource> = {
  AI: DbActionSource.AI,
  SYSTEM: DbActionSource.SYSTEM,
  UI: DbActionSource.UI,
};

export class PrismaShipmentRepository implements ShipmentRepository {
  async list(): Promise<ShipmentRecord[]> {
    try {
      const records = await prisma.shipment.findMany({
        include: shipmentInclude,
        orderBy: [{ etd: "asc" }, { id: "asc" }],
      });
      return records.map(toShipmentRecord);
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getById(id: string): Promise<ShipmentRecord | null> {
    try {
      const record = await prisma.shipment.findUnique({
        where: { id },
        include: shipmentInclude,
      });
      return record ? toShipmentRecord(record) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async advanceStatus(input: AdvanceStatusInput): Promise<ShipmentRecord | null> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.shipment.findUnique({ where: { id: input.shipmentId }, include: shipmentInclude });
      if (!before) return null;
      const beforeRecord = toShipmentRecord(before);
      const patchRecord: ShipmentRecord = {
        ...beforeRecord,
        ...(input.patch ?? {}),
        ...(input.status ? { status: input.status } : {}),
      };
      const after = await tx.shipment.update({
        where: { id: input.shipmentId },
        data: shipmentUpdateData(patchRecord),
        include: shipmentInclude,
      });
      return toShipmentRecord(after);
    });
  }

  async recordActionLog(input: ShipmentActionLogInput): Promise<void> {
    try {
      await prisma.shipmentActionLog.create({
        data: {
          shipmentId: input.shipmentId,
          actionType: actionTypeToDb[input.actionType],
          source: sourceToDb[input.source ?? "UI"],
          actorName: input.actorName ?? null,
          actorEmail: input.actorEmail ?? null,
          summary: input.summary,
          beforeSnapshot: input.beforeSnapshot
            ? (input.beforeSnapshot as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          afterSnapshot: input.afterSnapshot
            ? (input.afterSnapshot as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    } catch (error) {
      if (isPrismaUnavailable(error)) return;
      throw error;
    }
  }
}
