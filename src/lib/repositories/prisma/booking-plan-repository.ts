import { BookingPlanStatus as DbBookingPlanStatus, Prisma } from "@prisma/client";

import type { BookingPlanStatus } from "@/features/freightflow/booking-plan-rules";
import { prisma } from "@/lib/prisma";

import type {
  BookingPlanRecord,
  BookingPlanRepository,
  BookingPlanSnapshot,
  UpdatePlanStatusInput,
  UpsertBookingPlanInput,
} from "../booking-plan-repository";

const planStatusToDb: Record<BookingPlanStatus, DbBookingPlanStatus> = {
  draft_ready: DbBookingPlanStatus.DRAFT_READY,
  missing_info: DbBookingPlanStatus.MISSING_INFO,
  ready_to_draft: DbBookingPlanStatus.READY_TO_DRAFT,
  send_failed: DbBookingPlanStatus.SEND_FAILED,
  sent: DbBookingPlanStatus.SENT,
};

const dbStatusToUi: Record<DbBookingPlanStatus, BookingPlanStatus> = {
  [DbBookingPlanStatus.DRAFT_READY]: "draft_ready",
  [DbBookingPlanStatus.MISSING_INFO]: "missing_info",
  [DbBookingPlanStatus.READY_TO_DRAFT]: "ready_to_draft",
  [DbBookingPlanStatus.SEND_FAILED]: "send_failed",
  [DbBookingPlanStatus.SENT]: "sent",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asSnapshot(value: unknown): BookingPlanSnapshot {
  if (!value || typeof value !== "object") {
    return { missingFields: [], riskFlags: [] };
  }
  const candidate = value as { missingFields?: unknown; riskFlags?: unknown };
  return {
    missingFields: asStringArray(candidate.missingFields),
    riskFlags: asStringArray(candidate.riskFlags),
  };
}

function toRecord(record: {
  id: string;
  lastDraftId: string | null;
  lastError: string | null;
  planStatus: DbBookingPlanStatus;
  preferredBookingAgent: string | null;
  requiredFieldsSnapshot: unknown;
  shipmentId: string;
}): BookingPlanRecord {
  const snapshot = asSnapshot(record.requiredFieldsSnapshot);
  return {
    batchNo: "",
    bookingAgent: record.preferredBookingAgent ?? "",
    containerType: "",
    destinationPort: "",
    id: record.id,
    lastDraftId: record.lastDraftId,
    lastError: record.lastError,
    missingFields: snapshot.missingFields,
    originPort: "",
    planStatus: dbStatusToUi[record.planStatus],
    preferredBookingAgent: record.preferredBookingAgent,
    riskFlags: snapshot.riskFlags,
    shipmentId: record.shipmentId,
  };
}

function snapshotInput(snapshot: BookingPlanSnapshot) {
  return snapshot as unknown as Prisma.InputJsonValue;
}

export class PrismaBookingPlanRepository implements BookingPlanRepository {
  async list(): Promise<BookingPlanRecord[]> {
    const records = await prisma.bookingPlan.findMany();
    return records.map(toRecord);
  }

  async getByShipmentId(shipmentId: string): Promise<BookingPlanRecord | null> {
    const record = await prisma.bookingPlan.findUnique({ where: { shipmentId } });
    return record ? toRecord(record) : null;
  }

  async upsertForShipment(input: UpsertBookingPlanInput): Promise<BookingPlanRecord> {
    const data = {
      lastError: input.lastError ?? null,
      planStatus: planStatusToDb[input.planStatus],
      preferredBookingAgent: input.bookingAgent || input.preferredBookingAgent || null,
      requiredFieldsSnapshot: snapshotInput(input.snapshot),
      shipmentId: input.shipmentId,
    };

    const existing = await prisma.bookingPlan.findUnique({ where: { shipmentId: input.shipmentId } });
    if (existing) {
      const updated = await prisma.bookingPlan.update({
        data,
        where: { shipmentId: input.shipmentId },
      });
      return toRecord(updated);
    }

    const created = await prisma.bookingPlan.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        ...data,
      },
    });
    return toRecord(created);
  }

  async updateStatus(input: UpdatePlanStatusInput): Promise<BookingPlanRecord | null> {
    try {
      const updated = await prisma.bookingPlan.update({
        data: {
          lastError: input.lastError ?? undefined,
          lastDraftId: input.lastDraftId ?? undefined,
          planStatus: planStatusToDb[input.planStatus],
        },
        where: { id: input.id },
      });
      return toRecord(updated);
    } catch {
      return null;
    }
  }

  async bindLastDraft(planId: string, draftId: string | null): Promise<BookingPlanRecord | null> {
    try {
      const updated = await prisma.bookingPlan.update({
        data: { lastDraftId: draftId },
        where: { id: planId },
      });
      return toRecord(updated);
    } catch {
      return null;
    }
  }
}
