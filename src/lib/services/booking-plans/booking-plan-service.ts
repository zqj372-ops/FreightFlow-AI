import {
  BookingPlanStatus as DbBookingPlanStatus,
  EmailDraftStatus as DbEmailDraftStatus,
  EmailDraftType as DbEmailDraftType,
  Prisma,
  ShipmentStatus as DbShipmentStatus,
} from "@prisma/client";

import {
  buildBookingDraftBatchResult,
  buildBookingPlanRecord,
  buildBookingPlanRecords,
  type BookingDraftBatchResult,
  type BookingPlanRecord,
  type BookingPlanStatus,
} from "@/features/freightflow/booking-plan-rules";
import type { BookingDraft } from "@/features/freightflow/page-helpers";
import { isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";
import type { ShipmentRecord } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { parseShipmentEmailInput, sendShipmentEmail } from "@/lib/services/email/email-service";

const planStatusToDb = {
  draft_ready: DbBookingPlanStatus.DRAFT_READY,
  missing_info: DbBookingPlanStatus.MISSING_INFO,
  ready_to_draft: DbBookingPlanStatus.READY_TO_DRAFT,
  send_failed: DbBookingPlanStatus.SEND_FAILED,
  sent: DbBookingPlanStatus.SENT,
} satisfies Record<BookingPlanStatus, DbBookingPlanStatus>;

export type EmailDraftRecord = BookingDraft & {
  createdAt?: string;
  id: string;
  lastError: string | null;
  shipmentId: string;
  status: "draft" | "failed" | "pending_review" | "sent";
  updatedAt?: string;
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function listMockBookingPlans(records: ShipmentRecord[] = mockShipments): BookingPlanRecord[] {
  return buildBookingPlanRecords(records);
}

export function createMockBookingDraftBatch(
  selectedShipmentIds: string[],
  records: ShipmentRecord[] = mockShipments,
): BookingDraftBatchResult {
  return buildBookingDraftBatchResult(selectedShipmentIds, records);
}

async function upsertBookingPlanForShipment(shipment: ShipmentRecord) {
  const plan = buildBookingPlanRecord(shipment);

  if (plan.planStatus === "sent") return null;

  const record = await prisma.bookingPlan.upsert({
    create: {
      id: plan.id,
      shipmentId: plan.shipmentId,
      planStatus: planStatusToDb[plan.planStatus],
      preferredBookingAgent: plan.bookingAgent || null,
      requiredFieldsSnapshot: toInputJson({
        missingFields: plan.missingFields,
        riskFlags: plan.riskFlags,
      }),
    },
    update: {
      planStatus: planStatusToDb[plan.planStatus],
      preferredBookingAgent: plan.bookingAgent || null,
      requiredFieldsSnapshot: toInputJson({
        missingFields: plan.missingFields,
        riskFlags: plan.riskFlags,
      }),
    },
    where: { shipmentId: plan.shipmentId },
  });

  return { ...plan, id: record.id, lastDraftId: record.lastDraftId, lastError: record.lastError };
}

export async function listBookingPlans() {
  const shipments = await listShipmentsFromDatabase();
  const plans = await Promise.all(shipments.map((shipment) => upsertBookingPlanForShipment(shipment)));

  return plans.filter((plan): plan is BookingPlanRecord => plan !== null);
}

export async function listBookingPlansWithFallback() {
  try {
    return { data: await listBookingPlans(), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: listMockBookingPlans(), source: "mock" as const };
    }

    throw error;
  }
}

function mapDraftRecord(record: {
  attachmentName?: string | null;
  attachments: unknown;
  body: string;
  cc: unknown;
  createdAt?: Date;
  id: string;
  lastError: string | null;
  shipmentId: string;
  status: DbEmailDraftStatus;
  subject: string;
  to: unknown;
  updatedAt?: Date;
}): EmailDraftRecord {
  const attachments = asStringArray(record.attachments);

  return {
    attachmentName: attachments[0] ?? null,
    body: record.body,
    cc: asStringArray(record.cc),
    createdAt: record.createdAt?.toISOString(),
    id: record.id,
    lastError: record.lastError,
    shipmentId: record.shipmentId,
    status: record.status === DbEmailDraftStatus.SENT
      ? "sent"
      : record.status === DbEmailDraftStatus.FAILED
        ? "failed"
        : record.status === DbEmailDraftStatus.PENDING_REVIEW
          ? "pending_review"
          : "draft",
    subject: record.subject,
    to: asStringArray(record.to),
    updatedAt: record.updatedAt?.toISOString(),
  };
}

export async function createBookingDraftBatch(selectedShipmentIds: string[], createdBy?: string) {
  const shipments = await listShipmentsFromDatabase();
  const batchPreview = buildBookingDraftBatchResult(selectedShipmentIds, shipments);

  return prisma.$transaction(async (tx) => {
    const batch = await tx.bookingDraftBatch.create({
      data: {
        createdBy: createdBy?.trim() || null,
        failedCount: batchPreview.failedCount,
        selectedShipmentIds: toInputJson(selectedShipmentIds),
        skippedCount: batchPreview.skippedCount,
        successCount: batchPreview.successCount,
      },
    });

    const items = [];

    for (const item of batchPreview.items) {
      if (item.status !== "success" || !item.draft) {
        items.push(item);
        continue;
      }

      const plan = await tx.bookingPlan.upsert({
        create: {
          id: item.plan.id,
          lastBatchId: batch.id,
          planStatus: DbBookingPlanStatus.DRAFT_READY,
          preferredBookingAgent: item.plan.bookingAgent || null,
          requiredFieldsSnapshot: toInputJson({
            missingFields: item.plan.missingFields,
            riskFlags: item.plan.riskFlags,
          }),
          shipmentId: item.plan.shipmentId,
        },
        update: {
          lastBatchId: batch.id,
          lastError: null,
          planStatus: DbBookingPlanStatus.DRAFT_READY,
          requiredFieldsSnapshot: toInputJson({
            missingFields: item.plan.missingFields,
            riskFlags: item.plan.riskFlags,
          }),
        },
        where: { shipmentId: item.plan.shipmentId },
      });

      const draft = await tx.emailDraft.create({
        data: {
          attachments: toInputJson(item.draft.attachmentName ? [item.draft.attachmentName] : []),
          body: item.draft.body,
          cc: toInputJson(item.draft.cc),
          createdFromPlanId: plan.id,
          draftType: DbEmailDraftType.BOOKING,
          shipmentId: item.plan.shipmentId,
          status: DbEmailDraftStatus.PENDING_REVIEW,
          subject: item.draft.subject,
          to: toInputJson(item.draft.to),
        },
      });

      await tx.bookingPlan.update({
        data: { lastDraftId: draft.id },
        where: { id: plan.id },
      });

      items.push({
        ...item,
        draft: { ...item.draft, id: draft.id, shipmentId: draft.shipmentId, status: "pending_review" },
        plan: { ...item.plan, id: plan.id, lastDraftId: draft.id },
      });
    }

    return { ...batchPreview, batchId: batch.id, items };
  });
}

export async function createBookingDraftBatchWithFallback(selectedShipmentIds: string[], createdBy?: string) {
  try {
    return { data: await createBookingDraftBatch(selectedShipmentIds, createdBy), source: "database" as const };
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return { data: createMockBookingDraftBatch(selectedShipmentIds), source: "mock" as const };
    }

    throw error;
  }
}

export async function getEmailDraft(draftId: string) {
  const draft = await prisma.emailDraft.findUnique({ where: { id: draftId } });
  return draft ? mapDraftRecord(draft) : null;
}

export async function updateEmailDraft(draftId: string, draft: Partial<BookingDraft>) {
  const updated = await prisma.emailDraft.update({
    data: {
      ...(draft.attachmentName !== undefined
        ? { attachments: toInputJson(draft.attachmentName ? [draft.attachmentName] : []) }
        : {}),
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.cc !== undefined ? { cc: toInputJson(draft.cc) } : {}),
      ...(draft.subject !== undefined ? { subject: draft.subject } : {}),
      ...(draft.to !== undefined ? { to: toInputJson(draft.to) } : {}),
    },
    where: { id: draftId },
  });

  return mapDraftRecord(updated);
}

export async function sendEmailDraft(draftId: string) {
  const draft = await prisma.emailDraft.findUnique({ where: { id: draftId } });

  if (!draft) return null;

  const mapped = mapDraftRecord(draft);
  const input = parseShipmentEmailInput(mapped.shipmentId, {
    attachmentName: mapped.attachmentName,
    body: mapped.body,
    cc: mapped.cc,
    subject: mapped.subject,
    to: mapped.to,
  });
  const result = await sendShipmentEmail(input);

  await prisma.$transaction([
    prisma.emailDraft.update({
      data: {
        lastError: null,
        sentEmailLogId: result.emailLog.id,
        status: DbEmailDraftStatus.SENT,
      },
      where: { id: draftId },
    }),
    prisma.bookingPlan.updateMany({
      data: { planStatus: DbBookingPlanStatus.SENT },
      where: { lastDraftId: draftId },
    }),
    prisma.shipment.update({
      data: {
        lastEmailTime: result.providerMessage.sentAt,
        mailStatus: "SENT",
        status: DbShipmentStatus.WAITING_RELEASE,
      },
      where: { id: mapped.shipmentId },
    }),
  ]);

  return result;
}
