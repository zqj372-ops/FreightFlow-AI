import {
  ActionSource as DbActionSource,
  AlertLevel as DbAlertLevel,
  ContactRole as DbContactRole,
  DocumentProgressStatus as DbDocumentProgressStatus,
  MailStatus as DbMailStatus,
  Prisma,
  ShipmentActionType as DbShipmentActionType,
  ShipmentDocumentStatus as DbShipmentDocumentStatus,
  ShipmentStatus as DbShipmentStatus,
  SoStatus as DbSoStatus,
} from "@prisma/client";

import {
  getAlertLevel,
  shipments as mockShipments,
  type AlertLevel,
  type ShipmentRecord,
  type ShipmentStatus,
} from "./mock-data";
import { prisma } from "./prisma";
import type { ContactRecord, ContactRole, DetailActionLabel } from "../features/freightflow/page-helpers";

export const shipmentInclude = {
  documentProgress: true,
  exceptions: { orderBy: { sortOrder: "asc" as const } },
  reminderFlags: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ShipmentInclude;

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

export type ContactApiRecord = ContactRecord & {
  id?: string;
  isActive?: boolean;
};

export type ShipmentActionRequest = {
  action?: DetailActionLabel;
  actionType?: DetailActionLabel;
  actorEmail?: string;
  actorName?: string;
  body?: string;
  cc?: string[];
  exceptionMessage?: string;
  source?: "UI" | "AI" | "SYSTEM";
  subject?: string;
  to?: string[];
};

const shipmentStatusToDb = {
  待订舱: DbShipmentStatus.PENDING_BOOKING,
  已发送订舱: DbShipmentStatus.BOOKING_SENT,
  等待放舱: DbShipmentStatus.WAITING_RELEASE,
  已催放舱: DbShipmentStatus.RELEASE_FOLLOWED_UP,
  已放舱: DbShipmentStatus.RELEASED,
  待补料: DbShipmentStatus.PENDING_DOCUMENTS,
  已发送补料: DbShipmentStatus.DOCUMENTS_SENT,
  等待补料确认: DbShipmentStatus.DOCUMENTS_CONFIRMING,
  补料已确认: DbShipmentStatus.DOCUMENTS_CONFIRMED,
  待报关: DbShipmentStatus.PENDING_CUSTOMS,
  已报关: DbShipmentStatus.CUSTOMS_DECLARED,
  待提柜: DbShipmentStatus.PENDING_PICKUP,
  已提柜: DbShipmentStatus.PICKED_UP,
  已装柜: DbShipmentStatus.LOADED,
  已还柜: DbShipmentStatus.RETURNED,
  已开船: DbShipmentStatus.SAILED,
  已到港: DbShipmentStatus.ARRIVED,
  已签收: DbShipmentStatus.SIGNED,
  已完成: DbShipmentStatus.COMPLETED,
  异常处理中: DbShipmentStatus.EXCEPTION_PROCESSING,
} satisfies Record<ShipmentStatus, DbShipmentStatus>;

const dbShipmentStatusToUi = invertRecord(shipmentStatusToDb);

const alertLevelToDb = {
  red: DbAlertLevel.RED,
  yellow: DbAlertLevel.YELLOW,
  green: DbAlertLevel.GREEN,
} satisfies Record<AlertLevel, DbAlertLevel>;

const dbAlertLevelToUi = invertRecord(alertLevelToDb);

const documentProgressToDb = {
  待处理: DbDocumentProgressStatus.PENDING,
  草稿完成: DbDocumentProgressStatus.DRAFT_READY,
  已发送: DbDocumentProgressStatus.SENT,
} as const;

const dbDocumentProgressToUi = invertRecord(documentProgressToDb);

const mailStatusToDb = {
  未发送: DbMailStatus.NOT_SENT,
  已发送: DbMailStatus.SENT,
  跟进中: DbMailStatus.FOLLOWING_UP,
} as const;

const dbMailStatusToUi = invertRecord(mailStatusToDb);

const soStatusToDb = {
  待识别: DbSoStatus.PENDING_RECOGNITION,
  已识别: DbSoStatus.RECOGNIZED,
} as const;

const dbSoStatusToUi = invertRecord(soStatusToDb);

const shipmentDocumentStatusToDb = {
  待生成: DbShipmentDocumentStatus.PENDING_GENERATION,
  处理中: DbShipmentDocumentStatus.PROCESSING,
  已发送: DbShipmentDocumentStatus.SENT,
  已确认: DbShipmentDocumentStatus.CONFIRMED,
} as const;

const dbShipmentDocumentStatusToUi = invertRecord(shipmentDocumentStatusToDb);

const contactRoleToDb = {
  booking_agent: DbContactRole.BOOKING_AGENT,
  ops: DbContactRole.OPS,
  sales: DbContactRole.SALES,
  customs: DbContactRole.CUSTOMS,
} satisfies Record<ContactRole, DbContactRole>;

const dbContactRoleToUi = invertRecord(contactRoleToDb);

const actionTypeToDb = {
  订舱邮件: DbShipmentActionType.BOOKING_EMAIL,
  催单提醒: DbShipmentActionType.FOLLOW_UP,
  补料文件: DbShipmentActionType.DOCUMENTS,
  "SO 识别": DbShipmentActionType.SO_RECOGNITION,
  "AMS/ACI/ISF": DbShipmentActionType.CUSTOMS_PROGRESS,
  异常标记: DbShipmentActionType.EXCEPTION_MARK,
} satisfies Record<DetailActionLabel, DbShipmentActionType>;

const actionSources = new Set<string>(Object.values(DbActionSource));

function invertRecord<T extends string, U extends string>(record: Record<T, U>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [value, key])) as Record<U, T>;
}

export function isPrismaUnavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1000", "P1001", "P1002", "P1003", "P1010", "P1017", "P2021"].includes(error.code);
  }

  if (error instanceof Error) {
    return [
      "Can't reach database server",
      "Connection terminated",
      "DatabaseNotReachable",
      "ECONNREFUSED",
      "ENOTFOUND",
      "connect ECONNREFUSED",
    ].some((message) => error.message.includes(message));
  }

  return false;
}

export function formatDateForUi(value: Date | null) {
  if (!value) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  ].join(" ");
}

export function parseUiDate(value: string) {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return new Date(normalized);

  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

export function toShipmentRecord(shipment: ShipmentWithRelations): ShipmentRecord {
  return {
    id: shipment.id,
    batchNo: shipment.batchNo,
    soNo: shipment.soNo,
    containerNo: shipment.containerNo,
    bookingAgent: shipment.bookingAgent,
    carrier: shipment.carrier,
    originPort: shipment.originPort,
    transitPort: shipment.transitPort,
    destinationPort: shipment.destinationPort,
    containerType: shipment.containerType,
    vesselVoyage: shipment.vesselVoyage,
    etd: formatDateForUi(shipment.etd),
    eta: formatDateForUi(shipment.eta),
    cutoffTime: formatDateForUi(shipment.cutoffTime),
    pickupLocation: shipment.pickupLocation,
    returnLocation: shipment.returnLocation,
    status: dbShipmentStatusToUi[shipment.status],
    operator: shipment.operator,
    followUpCount: shipment.followUpCount,
    lastEmailTime: formatDateForUi(shipment.lastEmailTime),
    hoursWaitingRelease: shipment.hoursWaitingRelease,
    hoursToCutoff: shipment.hoursToCutoff,
    aiSummary: shipment.aiSummary,
    exceptions: shipment.exceptions.map((item) => item.message),
    nextAction: shipment.nextAction,
    reminderFlags: shipment.reminderFlags.map((item) => item.message),
    documentProgress: {
      ams: dbDocumentProgressToUi[shipment.documentProgress?.ams ?? DbDocumentProgressStatus.PENDING],
      aci: dbDocumentProgressToUi[shipment.documentProgress?.aci ?? DbDocumentProgressStatus.PENDING],
      isf: dbDocumentProgressToUi[shipment.documentProgress?.isf ?? DbDocumentProgressStatus.PENDING],
    },
    mailStatus: dbMailStatusToUi[shipment.mailStatus],
    soStatus: dbSoStatusToUi[shipment.soStatus],
    documentStatus: dbShipmentDocumentStatusToUi[shipment.documentStatus],
  };
}

export function toContactRecord(contact: {
  email: string;
  id?: string;
  isActive?: boolean;
  label: string;
  role: DbContactRole;
}): ContactApiRecord {
  return {
    id: contact.id,
    email: contact.email,
    isActive: contact.isActive,
    label: contact.label,
    role: dbContactRoleToUi[contact.role],
  };
}

export function shipmentCreateData(record: ShipmentRecord) {
  return {
    id: record.id,
    batchNo: record.batchNo,
    soNo: record.soNo,
    containerNo: record.containerNo,
    bookingAgent: record.bookingAgent,
    carrier: record.carrier,
    originPort: record.originPort,
    transitPort: record.transitPort,
    destinationPort: record.destinationPort,
    containerType: record.containerType,
    vesselVoyage: record.vesselVoyage,
    etd: parseUiDate(record.etd),
    eta: parseUiDate(record.eta),
    cutoffTime: parseUiDate(record.cutoffTime),
    pickupLocation: record.pickupLocation,
    returnLocation: record.returnLocation,
    status: shipmentStatusToDb[record.status],
    operator: record.operator,
    followUpCount: record.followUpCount,
    lastEmailTime: record.lastEmailTime ? parseUiDate(record.lastEmailTime) : null,
    hoursWaitingRelease: record.hoursWaitingRelease,
    hoursToCutoff: record.hoursToCutoff,
    aiSummary: record.aiSummary,
    nextAction: record.nextAction,
    alertLevel: alertLevelToDb[getAlertLevel(record)],
    mailStatus: mailStatusToDb[record.mailStatus],
    soStatus: soStatusToDb[record.soStatus],
    documentStatus: shipmentDocumentStatusToDb[record.documentStatus],
    documentProgress: {
      create: {
        ams: documentProgressToDb[record.documentProgress.ams],
        aci: documentProgressToDb[record.documentProgress.aci],
        isf: documentProgressToDb[record.documentProgress.isf],
      },
    },
    exceptions: {
      create: record.exceptions.map((message, sortOrder) => ({ message, sortOrder })),
    },
    reminderFlags: {
      create: record.reminderFlags.map((message, sortOrder) => ({ message, sortOrder })),
    },
  } satisfies Prisma.ShipmentCreateInput;
}

export function shipmentUpdateData(record: ShipmentRecord) {
  return {
    batchNo: record.batchNo,
    soNo: record.soNo,
    containerNo: record.containerNo,
    bookingAgent: record.bookingAgent,
    carrier: record.carrier,
    originPort: record.originPort,
    transitPort: record.transitPort,
    destinationPort: record.destinationPort,
    containerType: record.containerType,
    vesselVoyage: record.vesselVoyage,
    etd: parseUiDate(record.etd),
    eta: parseUiDate(record.eta),
    cutoffTime: parseUiDate(record.cutoffTime),
    pickupLocation: record.pickupLocation,
    returnLocation: record.returnLocation,
    status: shipmentStatusToDb[record.status],
    operator: record.operator,
    followUpCount: record.followUpCount,
    lastEmailTime: record.lastEmailTime ? parseUiDate(record.lastEmailTime) : null,
    hoursWaitingRelease: record.hoursWaitingRelease,
    hoursToCutoff: record.hoursToCutoff,
    aiSummary: record.aiSummary,
    nextAction: record.nextAction,
    alertLevel: alertLevelToDb[getAlertLevel(record)],
    mailStatus: mailStatusToDb[record.mailStatus],
    soStatus: soStatusToDb[record.soStatus],
    documentStatus: shipmentDocumentStatusToDb[record.documentStatus],
    documentProgress: {
      upsert: {
        create: {
          ams: documentProgressToDb[record.documentProgress.ams],
          aci: documentProgressToDb[record.documentProgress.aci],
          isf: documentProgressToDb[record.documentProgress.isf],
        },
        update: {
          ams: documentProgressToDb[record.documentProgress.ams],
          aci: documentProgressToDb[record.documentProgress.aci],
          isf: documentProgressToDb[record.documentProgress.isf],
        },
      },
    },
    exceptions: {
      deleteMany: {},
      create: record.exceptions.map((message, sortOrder) => ({ message, sortOrder })),
    },
    reminderFlags: {
      deleteMany: {},
      create: record.reminderFlags.map((message, sortOrder) => ({ message, sortOrder })),
    },
  } satisfies Prisma.ShipmentUpdateInput;
}

export async function listShipmentsFromDatabase() {
  const records = await prisma.shipment.findMany({
    include: shipmentInclude,
    orderBy: [{ etd: "asc" }, { id: "asc" }],
  });

  return records.map(toShipmentRecord);
}

export async function getShipmentFromDatabase(id: string) {
  const record = await prisma.shipment.findUnique({
    where: { id },
    include: shipmentInclude,
  });

  return record ? toShipmentRecord(record) : null;
}

export function getMockShipment(id: string) {
  return mockShipments.find((shipment) => shipment.id === id) ?? null;
}

export function getFallbackContacts(): ContactApiRecord[] {
  const contacts = new Map<string, ContactApiRecord>();

  const addContact = (contact: ContactApiRecord) => {
    contacts.set(contact.email.toLowerCase(), contact);
  };

  for (const shipment of mockShipments) {
    addContact({
      email: `${shipment.bookingAgent.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`,
      label: `${shipment.bookingAgent} booking desk`,
      role: "booking_agent",
    });
    addContact({
      email: `${shipment.operator.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`,
      label: `${shipment.operator} operator`,
      role: "ops",
    });
  }

  addContact({ email: "ops@freightflow.ai", label: "FreightFlow operations", role: "ops" });
  addContact({ email: "sales@freightflow.ai", label: "Sales owner", role: "sales" });
  addContact({ email: "customs.docs@freightflow.ai", label: "Customs documents", role: "customs" });

  return Array.from(contacts.values()).sort((a, b) => a.email.localeCompare(b.email));
}

export function normalizeContactInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return { error: "Request body must be an object." } as const;
  }

  const body = input as Partial<ContactRecord>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const role = body.role;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email is required." } as const;
  }

  if (!label) {
    return { error: "A contact label is required." } as const;
  }

  if (!role || !(role in contactRoleToDb)) {
    return { error: "Role must be one of booking_agent, ops, sales, customs." } as const;
  }

  return {
    value: {
      email,
      label,
      role,
      dbRole: contactRoleToDb[role],
    },
  } as const;
}

export function normalizeShipmentAction(input: unknown) {
  if (!input || typeof input !== "object") {
    return { error: "Request body must be an object." } as const;
  }

  const body = input as ShipmentActionRequest;
  const action = body.action ?? body.actionType;

  if (!action || !(action in actionTypeToDb)) {
    return { error: "action must be one of 订舱邮件, 催单提醒, 补料文件, SO 识别, AMS/ACI/ISF, 异常标记." } as const;
  }

  if (body.source && !actionSources.has(body.source)) {
    return { error: "source must be UI, AI, or SYSTEM." } as const;
  }

  return { value: { ...body, action } } as const;
}

export function applyShipmentAction(record: ShipmentRecord, input: ShipmentActionRequest & { action: DetailActionLabel }) {
  const now = formatDateForUi(new Date());

  switch (input.action) {
    case "订舱邮件":
      return {
        record: {
          ...record,
          lastEmailTime: now,
          mailStatus: "已发送" as const,
          status: record.status === "等待放舱" ? record.status : ("已发送订舱" as const),
        },
        summary: input.subject ? `已记录订舱邮件：${input.subject}` : "已记录订舱邮件发送动作",
      };
    case "催单提醒":
      return {
        record: {
          ...record,
          followUpCount: record.followUpCount + 1,
          lastEmailTime: now,
          mailStatus: "跟进中" as const,
          reminderFlags: Array.from(new Set(["已手动催单", ...record.reminderFlags])),
          status:
            record.status === "等待放舱" || record.status === "已发送订舱"
              ? ("已催放舱" as const)
              : record.status,
        },
        summary: "已增加一次催单记录",
      };
    case "补料文件":
      return {
        record: {
          ...record,
          documentStatus: "已发送" as const,
          lastEmailTime: now,
          status: record.status === "待补料" ? ("已发送补料" as const) : record.status,
        },
        summary: "补料文件状态已推进",
      };
    case "SO 识别":
      return {
        record: {
          ...record,
          soStatus: "已识别" as const,
          status:
            record.status === "已催放舱" || record.status === "等待放舱"
              ? ("已放舱" as const)
              : record.status,
        },
        summary: "SO 识别状态已更新",
      };
    case "AMS/ACI/ISF":
      return {
        record: {
          ...record,
          documentProgress: {
            ams: "已发送" as const,
            aci: record.documentProgress.aci === "待处理" ? ("草稿完成" as const) : record.documentProgress.aci,
            isf: "已发送" as const,
          },
        },
        summary: "AMS / ACI / ISF 进度已刷新",
      };
    case "异常标记": {
      const message = input.exceptionMessage?.trim() || "人工标记异常";
      const nextIsException = record.status !== "异常处理中";

      return {
        record: {
          ...record,
          exceptions: nextIsException ? Array.from(new Set([message, ...record.exceptions])) : [],
          status: nextIsException ? ("异常处理中" as const) : ("待补料" as const),
        },
        summary: nextIsException ? `已标记异常：${message}` : "已清空异常并恢复待补料",
      };
    }
  }
}

export async function persistShipmentAction(id: string, input: ShipmentActionRequest & { action: DetailActionLabel }) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.shipment.findUnique({ where: { id }, include: shipmentInclude });

    if (!before) return null;

    const beforeRecord = toShipmentRecord(before);
    const { record: afterRecord, summary } = applyShipmentAction(beforeRecord, input);

    const after = await tx.shipment.update({
      where: { id },
      data: shipmentUpdateData(afterRecord),
      include: shipmentInclude,
    });

    const actionLog = await tx.shipmentActionLog.create({
      data: {
        shipmentId: id,
        actionType: actionTypeToDb[input.action],
        source: input.source ? (input.source as DbActionSource) : DbActionSource.UI,
        actorName: input.actorName?.trim() || null,
        actorEmail: input.actorEmail?.trim() || null,
        summary,
        beforeSnapshot: beforeRecord as unknown as Prisma.InputJsonValue,
        afterSnapshot: afterRecord as unknown as Prisma.InputJsonValue,
      },
    });

    if (input.action === "订舱邮件" && input.subject && input.body) {
      await tx.shipmentEmailLog.create({
        data: {
          shipmentId: id,
          subject: input.subject,
          body: input.body,
          sentAt: new Date(),
          recipients: {
            create: [
              ...(input.to ?? []).map((email) => ({ email, recipientType: "TO" as const })),
              ...(input.cc ?? []).map((email) => ({ email, recipientType: "CC" as const })),
            ],
          },
        },
      });
    }

    return {
      actionLog,
      shipment: toShipmentRecord(after),
    };
  });
}

export { alertLevelToDb, contactRoleToDb, dbAlertLevelToUi, mockShipments, shipmentStatusToDb };
