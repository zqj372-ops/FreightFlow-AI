import { Prisma, type BookingPlan as DbBookingPlan } from "@prisma/client";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type {
  BookingPlanRecord,
  BookingPlanRepository,
  BookingPlanSnapshot,
  UpdatePlanStatusInput,
  UpsertBookingPlanInput,
} from "../booking-plan-repository";
import { type BookingPlanStatus } from "../types";

const dbToBookingPlanStatus: Record<string, BookingPlanStatus> = {
  MISSING_INFO: "missing_info",
  READY_TO_DRAFT: "ready_to_draft",
  DRAFT_READY: "draft_ready",
  SEND_FAILED: "send_failed",
  SENT: "sent",
};

function toDbBookingPlanStatus(value: BookingPlanStatus) {
  return value.toUpperCase() as
    | "MISSING_INFO"
    | "READY_TO_DRAFT"
    | "DRAFT_READY"
    | "SEND_FAILED"
    | "SENT";
}

function toRecord(
  plan: DbBookingPlan & {
    shipment?: {
      batchNo: string;
      bookingAgent: string;
      containerType: string;
      destinationPort: string;
      originPort: string;
    } | null;
  },
): BookingPlanRecord {
  const snapshot = readSnapshot(plan.requiredFieldsSnapshot);
  return {
    batchNo: plan.shipment?.batchNo ?? "",
    bookingAgent: plan.shipment?.bookingAgent ?? "",
    containerType: plan.shipment?.containerType ?? "",
    destinationPort: plan.shipment?.destinationPort ?? "",
    id: plan.id,
    lastDraftId: plan.lastDraftId,
    lastError: plan.lastError,
    missingFields: snapshot.missingFields,
    originPort: plan.shipment?.originPort ?? "",
    planStatus: dbToBookingPlanStatus[plan.planStatus] ?? "missing_info",
    preferredBookingAgent: plan.preferredBookingAgent,
    riskFlags: snapshot.riskFlags,
    shipmentId: plan.shipmentId,
  };
}

function readSnapshot(value: Prisma.JsonValue | null | undefined): BookingPlanSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { missingFields: [], riskFlags: [] };
  }
  const obj = value as { missingFields?: unknown; riskFlags?: unknown };
  return {
    missingFields: Array.isArray(obj.missingFields)
      ? obj.missingFields.filter((s): s is string => typeof s === "string")
      : [],
    riskFlags: Array.isArray(obj.riskFlags)
      ? obj.riskFlags.filter((s): s is string => typeof s === "string")
      : [],
  };
}

function buildFallback(input: UpsertBookingPlanInput, id: string): BookingPlanRecord {
  return {
    batchNo: input.batchNo,
    bookingAgent: input.bookingAgent,
    containerType: input.containerType,
    destinationPort: input.destinationPort,
    id,
    lastDraftId: null,
    lastError: input.lastError ?? null,
    missingFields: [...input.snapshot.missingFields],
    originPort: input.originPort,
    planStatus: input.planStatus,
    preferredBookingAgent: input.preferredBookingAgent ?? null,
    riskFlags: [...input.snapshot.riskFlags],
    shipmentId: input.shipmentId,
  };
}

export class PrismaBookingPlanRepository implements BookingPlanRepository {
  async list(): Promise<BookingPlanRecord[]> {
    try {
      const plans = await prisma.bookingPlan.findMany({
        include: { shipment: true },
        orderBy: { updatedAt: "desc" },
      });
      return plans.map((plan) => toRecord(plan));
    } catch (error) {
      if (isPrismaUnavailable(error)) return [];
      throw error;
    }
  }

  async getByShipmentId(shipmentId: string): Promise<BookingPlanRecord | null> {
    try {
      const plan = await prisma.bookingPlan.findUnique({
        where: { shipmentId },
        include: { shipment: true },
      });
      return plan ? toRecord(plan) : null;
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async upsertForShipment(input: UpsertBookingPlanInput): Promise<BookingPlanRecord> {
    const data = {
      lastError: input.lastError ?? null,
      planStatus: toDbBookingPlanStatus(input.planStatus),
      preferredBookingAgent: input.preferredBookingAgent ?? null,
      requiredFieldsSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      shipmentId: input.shipmentId,
    } satisfies Prisma.BookingPlanUncheckedCreateInput;

    try {
      const plan = await prisma.bookingPlan.upsert({
        where: { shipmentId: input.shipmentId },
        create: data,
        update: {
          lastError: input.lastError ?? null,
          planStatus: toDbBookingPlanStatus(input.planStatus),
          preferredBookingAgent: input.preferredBookingAgent ?? null,
          requiredFieldsSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
        },
        include: { shipment: true },
      });
      return toRecord(plan);
    } catch (error) {
      if (isPrismaUnavailable(error)) {
        const id = input.id ?? `prisma-fallback-${input.shipmentId}`;
        return buildFallback(input, id);
      }
      throw error;
    }
  }

  async updateStatus(input: UpdatePlanStatusInput): Promise<BookingPlanRecord | null> {
    try {
      const plan = await prisma.bookingPlan.update({
        where: { id: input.id },
        data: {
          lastDraftId: input.lastDraftId === undefined ? undefined : input.lastDraftId,
          lastError: input.lastError === undefined ? undefined : input.lastError,
          planStatus: toDbBookingPlanStatus(input.planStatus),
        },
        include: { shipment: true },
      });
      return toRecord(plan);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }

  async bindLastDraft(planId: string, draftId: string | null): Promise<BookingPlanRecord | null> {
    try {
      const plan = await prisma.bookingPlan.update({
        where: { id: planId },
        data: { lastDraftId: draftId },
        include: { shipment: true },
      });
      return toRecord(plan);
    } catch (error) {
      if (isPrismaUnavailable(error)) return null;
      throw error;
    }
  }
}
