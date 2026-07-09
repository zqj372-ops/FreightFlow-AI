import {
  ActionSource as DbActionSource,
  AlertLevel as DbAlertLevel,
  BookingStatus as DbBookingStatus,
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
  applyShipmentAction,
  detailActionLabels,
  formatFreightFlowEmail,
  isDetailActionLabel,
  type ContactRecord,
  type ContactRole,
  type DetailActionLabel,
  type ShipmentActionRequest,
} from "./freightflow-domain";
import {
  getAlertLevel,
  shipments as mockShipments,
  type AlertLevel,
  type BookingStatus,
  type ShipmentRecord,
  type ShipmentStatus,
} from "./mock-data";
import { prisma } from "./prisma";

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

const shipmentStatusToDb = {
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

const bookingStatusToDb = {
  订舱草稿: DbBookingStatus.BOOKING_DRAFT,
  已发送订舱: DbBookingStatus.BOOKING_SENT,
  "等待 SO": DbBookingStatus.WAITING_SO,
  "SO 已收到": DbBookingStatus.SO_RECEIVED,
  "SO 复核中": DbBookingStatus.SO_REVIEWING,
  已放舱: DbBookingStatus.RELEASED,
  待补料: DbBookingStatus.PENDING_DOCUMENTS,
  失败: DbBookingStatus.FAILED,
} satisfies Record<BookingStatus, DbBookingStatus>;

const dbBookingStatusToUi = invertRecord(bookingStatusToDb);

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

function shipmentActionTypeForLog(input: ShipmentActionRequest & { action: DetailActionLabel }) {
  if (input.action === "SO 识别" && input.soStage === "received") return DbShipmentActionType.SO_RECEIVED;
  if (input.action === "SO 识别" && input.soStage === "applied") return DbShipmentActionType.SO_APPLIED;

  return actionTypeToDb[input.action];
}

const actionSources = new Set<string>(Object.values(DbActionSource));
const mailStatuses = new Set<ShipmentRecord["mailStatus"]>(["未发送", "已发送", "跟进中"]);
const soStatuses = new Set<ShipmentRecord["soStatus"]>(["待识别", "已识别"]);
const shipmentDocumentStatuses = new Set<ShipmentRecord["documentStatus"]>(["待生成", "处理中", "已发送", "已确认"]);
const documentProgressStatuses = new Set<ShipmentRecord["documentProgress"]["ams"]>(["待处理", "草稿完成", "已发送"]);

function invertRecord<T extends string, U extends string>(record: Record<T, U>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [value, key])) as Record<U, T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeActionSource(value: unknown) {
  return typeof value === "string" && actionSources.has(value) ? (value as DbActionSource) : DbActionSource.UI;
}

function stringValue(value: unknown, fallback?: string) {
  return typeof value === "string" ? value.trim() : fallback ?? "";
}

function numberValue(value: unknown, fallback?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback ?? 0;
}

function stringArrayValue(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : fallback;
}

function documentProgressValue(value: unknown, fallback: ShipmentRecord["documentProgress"]) {
  const input = isRecord(value) ? value : {};
  const readStatus = (key: keyof ShipmentRecord["documentProgress"]) => {
    const candidate = stringValue(input[key], fallback[key]);
    return documentProgressStatuses.has(candidate as ShipmentRecord["documentProgress"]["ams"])
      ? (candidate as ShipmentRecord["documentProgress"]["ams"])
      : fallback[key];
  };

  return {
    ams: readStatus("ams"),
    aci: readStatus("aci"),
    isf: readStatus("isf"),
  };
}

function inferBookingStatus(record: Pick<ShipmentRecord, "mailStatus" | "soStatus" | "status">): BookingStatus {
  if (record.status === "异常处理中") return record.soStatus === "已识别" ? "SO 复核中" : "失败";
  if (record.status === "已放舱") return "已放舱";
  if (["待补料", "已发送补料", "等待补料确认", "补料已确认"].includes(record.status)) return "待补料";
  if (record.mailStatus === "未发送") return "订舱草稿";
  return "等待 SO";
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
    bookingStatus: dbBookingStatusToUi[shipment.bookingStatus],
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
    bookingStatus: bookingStatusToDb[record.bookingStatus],
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
    bookingStatus: bookingStatusToDb[record.bookingStatus],
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
      email: formatFreightFlowEmail(shipment.bookingAgent),
      label: `${shipment.bookingAgent} booking desk`,
      role: "booking_agent",
    });
    addContact({
      email: formatFreightFlowEmail(shipment.operator),
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

  if (!isDetailActionLabel(action)) {
    return { error: `action must be one of ${detailActionLabels.join(", ")}.` } as const;
  }

  if (body.source && !actionSources.has(body.source)) {
    return { error: "source must be UI, AI, or SYSTEM." } as const;
  }

  if (body.soStage && !["received", "reviewing", "applied"].includes(body.soStage)) {
    return { error: "soStage must be received, reviewing, or applied." } as const;
  }

  return { value: { ...body, action } } as const;
}

type ShipmentMutationMetadata = {
  actorEmail?: string | null;
  actorName?: string | null;
  source?: DbActionSource;
  summary?: string;
};

function normalizeShipmentMutation(input: unknown, fallback?: ShipmentRecord) {
  if (!isRecord(input)) {
    return { error: "Request body must be an object." } as const;
  }

  const body = isRecord(input.shipment) ? input.shipment : input;
  const fallbackProgress = fallback?.documentProgress ?? { aci: "待处理" as const, ams: "待处理" as const, isf: "待处理" as const };
  const status = stringValue(body.status, fallback?.status ?? "已发送订舱") as ShipmentStatus;
  const mailStatus = stringValue(body.mailStatus, fallback?.mailStatus ?? "未发送") as ShipmentRecord["mailStatus"];
  const soStatus = stringValue(body.soStatus, fallback?.soStatus ?? "待识别") as ShipmentRecord["soStatus"];
  const documentStatus = stringValue(body.documentStatus, fallback?.documentStatus ?? "待生成") as ShipmentRecord["documentStatus"];

  if (!(status in shipmentStatusToDb)) {
    return { error: "status is invalid." } as const;
  }

  if (!mailStatuses.has(mailStatus)) {
    return { error: "mailStatus is invalid." } as const;
  }

  if (!soStatuses.has(soStatus)) {
    return { error: "soStatus is invalid." } as const;
  }

  if (!shipmentDocumentStatuses.has(documentStatus)) {
    return { error: "documentStatus is invalid." } as const;
  }

  const inferredBookingStatus = inferBookingStatus({ mailStatus, soStatus, status });
  const bookingStatus = stringValue(body.bookingStatus, fallback?.bookingStatus ?? inferredBookingStatus) as BookingStatus;

  if (!(bookingStatus in bookingStatusToDb)) {
    return { error: "bookingStatus is invalid." } as const;
  }

  const record = {
    id: stringValue(body.id, fallback?.id),
    batchNo: stringValue(body.batchNo, fallback?.batchNo),
    soNo: stringValue(body.soNo, fallback?.soNo),
    containerNo: stringValue(body.containerNo, fallback?.containerNo),
    bookingAgent: stringValue(body.bookingAgent, fallback?.bookingAgent),
    carrier: stringValue(body.carrier, fallback?.carrier),
    originPort: stringValue(body.originPort, fallback?.originPort),
    transitPort: stringValue(body.transitPort, fallback?.transitPort),
    destinationPort: stringValue(body.destinationPort, fallback?.destinationPort),
    containerType: stringValue(body.containerType, fallback?.containerType),
    vesselVoyage: stringValue(body.vesselVoyage, fallback?.vesselVoyage),
    etd: stringValue(body.etd, fallback?.etd),
    eta: stringValue(body.eta, fallback?.eta),
    cutoffTime: stringValue(body.cutoffTime, fallback?.cutoffTime),
    pickupLocation: stringValue(body.pickupLocation, fallback?.pickupLocation),
    returnLocation: stringValue(body.returnLocation, fallback?.returnLocation),
    status,
    bookingStatus,
    operator: stringValue(body.operator, fallback?.operator),
    followUpCount: numberValue(body.followUpCount, fallback?.followUpCount),
    lastEmailTime: stringValue(body.lastEmailTime, fallback?.lastEmailTime),
    hoursWaitingRelease: numberValue(body.hoursWaitingRelease, fallback?.hoursWaitingRelease),
    hoursToCutoff: numberValue(body.hoursToCutoff, fallback?.hoursToCutoff),
    aiSummary: stringValue(body.aiSummary, fallback?.aiSummary),
    exceptions: stringArrayValue(body.exceptions, fallback?.exceptions ?? []),
    nextAction: stringValue(body.nextAction, fallback?.nextAction),
    reminderFlags: stringArrayValue(body.reminderFlags, fallback?.reminderFlags ?? []),
    documentProgress: documentProgressValue(body.documentProgress, fallbackProgress),
    mailStatus,
    soStatus,
    documentStatus,
  } satisfies ShipmentRecord;

  const missingRequiredField = ["id", "batchNo", "etd", "eta", "cutoffTime"].find((field) => !record[field as keyof ShipmentRecord]);

  if (missingRequiredField) {
    return { error: `${missingRequiredField} is required.` } as const;
  }

  return {
    value: {
      metadata: {
        actorEmail: stringValue(input.actorEmail) || null,
        actorName: stringValue(input.actorName) || null,
        source: normalizeActionSource(input.source),
        summary: stringValue(input.summary),
      } satisfies ShipmentMutationMetadata,
      record,
    },
  } as const;
}

export async function createShipmentInDatabase(input: unknown) {
  const parsed = normalizeShipmentMutation(input);

  if ("error" in parsed) return parsed;

  const { metadata, record } = parsed.value;

  return prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: shipmentCreateData(record),
      include: shipmentInclude,
    });
    const shipment = toShipmentRecord(created);
    const actionLog = await tx.shipmentActionLog.create({
      data: {
        shipmentId: shipment.id,
        actionType: DbShipmentActionType.SHIPMENT_CREATED,
        source: metadata.source,
        actorName: metadata.actorName,
        actorEmail: metadata.actorEmail,
        summary: metadata.summary || "Shipment created.",
        beforeSnapshot: Prisma.JsonNull,
        afterSnapshot: jsonSnapshot(shipment),
      },
    });

    return { actionLog, shipment };
  });
}

export async function updateShipmentInDatabase(id: string, input: unknown) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.shipment.findUnique({ where: { id }, include: shipmentInclude });

    if (!before) return { notFound: true } as const;

    const beforeRecord = toShipmentRecord(before);
    const parsed = normalizeShipmentMutation(input, beforeRecord);

    if ("error" in parsed) return parsed;

    const { metadata, record } = parsed.value;
    const after = await tx.shipment.update({
      where: { id },
      data: shipmentUpdateData({ ...record, id }),
      include: shipmentInclude,
    });
    const afterRecord = toShipmentRecord(after);
    const actionLog = await tx.shipmentActionLog.create({
      data: {
        shipmentId: id,
        actionType: DbShipmentActionType.SHIPMENT_UPDATED,
        source: metadata.source,
        actorName: metadata.actorName,
        actorEmail: metadata.actorEmail,
        summary: metadata.summary || "Shipment updated.",
        beforeSnapshot: jsonSnapshot(beforeRecord),
        afterSnapshot: jsonSnapshot(afterRecord),
      },
    });

    return { actionLog, shipment: afterRecord };
  });
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
        actionType: shipmentActionTypeForLog(input),
        source: input.source ? (input.source as DbActionSource) : DbActionSource.UI,
        actorName: input.actorName?.trim() || null,
        actorEmail: input.actorEmail?.trim() || null,
        summary,
        beforeSnapshot: jsonSnapshot(beforeRecord),
        afterSnapshot: jsonSnapshot(afterRecord),
      },
    });

    if (input.action === "订舱邮件" && input.subject && input.body && !input.skipEmailLog) {
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

export { alertLevelToDb, bookingStatusToDb, contactRoleToDb, dbAlertLevelToUi, mockShipments, shipmentStatusToDb };
