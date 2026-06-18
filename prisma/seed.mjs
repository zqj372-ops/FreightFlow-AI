import {
  AlertLevel,
  ContactRole as DbContactRole,
  DocumentProgressStatus,
  MailStatus,
  PrismaClient,
  ShipmentDocumentStatus,
  ShipmentStatus as DbShipmentStatus,
  SoStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { getAlertLevel, shipments as mockShipments } from "../src/lib/mock-data.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/freightflow_ai?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

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
};

const documentProgressToDb = {
  待处理: DocumentProgressStatus.PENDING,
  草稿完成: DocumentProgressStatus.DRAFT_READY,
  已发送: DocumentProgressStatus.SENT,
};

const mailStatusToDb = {
  未发送: MailStatus.NOT_SENT,
  已发送: MailStatus.SENT,
  跟进中: MailStatus.FOLLOWING_UP,
};

const soStatusToDb = {
  待识别: SoStatus.PENDING_RECOGNITION,
  已识别: SoStatus.RECOGNIZED,
};

const shipmentDocumentStatusToDb = {
  待生成: ShipmentDocumentStatus.PENDING_GENERATION,
  处理中: ShipmentDocumentStatus.PROCESSING,
  已发送: ShipmentDocumentStatus.SENT,
  已确认: ShipmentDocumentStatus.CONFIRMED,
};

const alertLevelToDb = {
  red: AlertLevel.RED,
  yellow: AlertLevel.YELLOW,
  green: AlertLevel.GREEN,
};

const contactRoleToDb = {
  booking_agent: DbContactRole.BOOKING_AGENT,
  ops: DbContactRole.OPS,
  sales: DbContactRole.SALES,
  customs: DbContactRole.CUSTOMS,
};

function formatFreightFlowEmail(value) {
  return `${value.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`;
}

function parseUiDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return new Date(value);

  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function buildSeedContacts() {
  const contacts = new Map();

  const addContact = (contact) => {
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

  return Array.from(contacts.values());
}

function shipmentCreateData(record) {
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
  };
}

function shipmentUpdateData(record) {
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
  };
}

async function main() {
  for (const shipment of mockShipments) {
    await prisma.shipment.upsert({
      where: { id: shipment.id },
      create: shipmentCreateData(shipment),
      update: shipmentUpdateData(shipment),
    });
  }

  const contacts = buildSeedContacts();

  for (const contact of contacts) {
    await prisma.contact.upsert({
      where: { email: contact.email.toLowerCase() },
      create: {
        email: contact.email.toLowerCase(),
        label: contact.label,
        role: contactRoleToDb[contact.role],
      },
      update: {
        isActive: true,
        label: contact.label,
        role: contactRoleToDb[contact.role],
      },
    });
  }

  console.log(`Seeded ${mockShipments.length} shipments and ${contacts.length} contacts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
