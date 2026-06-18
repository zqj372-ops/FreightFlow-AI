import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type ShipmentAttachmentRecord = {
  byteSize: number;
  checksum: string;
  createdAt: string;
  documentType: string;
  fileName: string;
  id: string;
  mimeType: string;
  ocrConfidence: number | null;
  ocrStatus: "failed" | "not_started" | "recognized" | "unsupported";
  ocrText: string | null;
  originalName: string;
  shipmentId: string;
  storageKey: string;
  updatedAt: string;
  uploadedBy: string | null;
};

export type StoreAttachmentInput = {
  buffer: Buffer;
  documentType?: string;
  mimeType?: string;
  originalName: string;
  shipmentId: string;
  uploadedBy?: string | null;
};

export type OcrPatch = {
  ocrConfidence?: number | null;
  ocrStatus: ShipmentAttachmentRecord["ocrStatus"];
  ocrText?: string | null;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const INDEX_FILE_NAME = "attachments-index.json";

function storageRoot() {
  return process.env.FREIGHTFLOW_STORAGE_DIR?.trim() || path.join(".freightflow", "storage");
}

function indexPath() {
  return path.join(storageRoot(), INDEX_FILE_NAME);
}

function normalizeDocumentType(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return normalized || "attachment";
}

function safeFileName(value: string) {
  const base = path.basename(value || "attachment").replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_");
  return base.slice(0, 180) || "attachment";
}

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function toPublicRecord(record: ShipmentAttachmentRecord): ShipmentAttachmentRecord {
  return {
    ...record,
    ocrConfidence: record.ocrConfidence ?? null,
    ocrText: record.ocrText ?? null,
    uploadedBy: record.uploadedBy ?? null,
  };
}

function mapPrismaAttachment(record: {
  byteSize: number;
  checksum: string;
  createdAt: Date;
  documentType: string;
  fileName: string;
  id: string;
  mimeType: string;
  ocrConfidence: number | null;
  ocrStatus: string;
  ocrText: string | null;
  originalName: string;
  shipmentId: string;
  storageKey: string;
  updatedAt: Date;
  uploadedBy: string | null;
}): ShipmentAttachmentRecord {
  return {
    byteSize: record.byteSize,
    checksum: record.checksum,
    createdAt: record.createdAt.toISOString(),
    documentType: record.documentType,
    fileName: record.fileName,
    id: record.id,
    mimeType: record.mimeType,
    ocrConfidence: record.ocrConfidence,
    ocrStatus: normalizeOcrStatus(record.ocrStatus),
    ocrText: record.ocrText,
    originalName: record.originalName,
    shipmentId: record.shipmentId,
    storageKey: record.storageKey,
    updatedAt: record.updatedAt.toISOString(),
    uploadedBy: record.uploadedBy,
  };
}

function normalizeOcrStatus(value: string): ShipmentAttachmentRecord["ocrStatus"] {
  if (value === "failed" || value === "recognized" || value === "unsupported") return value;
  return "not_started";
}

async function readIndex() {
  try {
    const content = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(content) as ShipmentAttachmentRecord[];
    return parsed.map(toPublicRecord);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeIndex(records: ShipmentAttachmentRecord[]) {
  await mkdir(storageRoot(), { recursive: true });
  await writeFile(indexPath(), `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export function resolveAttachmentPath(record: Pick<ShipmentAttachmentRecord, "storageKey">) {
  return path.join(storageRoot(), record.storageKey);
}

export async function listShipmentAttachments(shipmentId: string) {
  if (isDatabaseConfigured()) {
    try {
      const records = await prisma.shipmentAttachment.findMany({
        orderBy: { createdAt: "desc" },
        where: { shipmentId },
      });
      return { data: records.map(mapPrismaAttachment), source: "database" as const };
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  const records = await readIndex();
  return {
    data: records.filter((record) => record.shipmentId === shipmentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    source: "local" as const,
  };
}

export async function getShipmentAttachment(shipmentId: string, attachmentId: string) {
  if (isDatabaseConfigured()) {
    try {
      const record = await prisma.shipmentAttachment.findFirst({
        where: { id: attachmentId, shipmentId },
      });
      return record ? { data: mapPrismaAttachment(record), source: "database" as const } : null;
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  const record = (await readIndex()).find((entry) => entry.id === attachmentId && entry.shipmentId === shipmentId);
  return record ? { data: record, source: "local" as const } : null;
}

export async function storeShipmentAttachment(input: StoreAttachmentInput) {
  if (input.buffer.byteLength === 0) throw new Error("上传文件不能为空。");
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error("上传文件不能超过 20MB。");

  const id = randomUUID();
  const now = new Date().toISOString();
  const originalName = safeFileName(input.originalName);
  const fileName = `${id}-${originalName}`;
  const storageKey = path.join("shipments", input.shipmentId, fileName);
  const absolutePath = resolveAttachmentPath({ storageKey });

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  const record: ShipmentAttachmentRecord = {
    byteSize: input.buffer.byteLength,
    checksum: checksum(input.buffer),
    createdAt: now,
    documentType: normalizeDocumentType(input.documentType),
    fileName,
    id,
    mimeType: input.mimeType?.trim() || "application/octet-stream",
    ocrConfidence: null,
    ocrStatus: "not_started",
    ocrText: null,
    originalName,
    shipmentId: input.shipmentId,
    storageKey,
    updatedAt: now,
    uploadedBy: input.uploadedBy?.trim() || null,
  };

  if (isDatabaseConfigured()) {
    try {
      const created = await prisma.shipmentAttachment.create({
        data: {
          byteSize: record.byteSize,
          checksum: record.checksum,
          documentType: record.documentType,
          fileName: record.fileName,
          id: record.id,
          mimeType: record.mimeType,
          originalName: record.originalName,
          shipmentId: record.shipmentId,
          storageKey: record.storageKey,
          uploadedBy: record.uploadedBy,
        },
      });
      return { data: mapPrismaAttachment(created), filePath: absolutePath, source: "database" as const };
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  const records = await readIndex();
  records.push(record);
  await writeIndex(records);
  return { data: record, filePath: absolutePath, source: "local" as const };
}

export async function updateAttachmentOcr(shipmentId: string, attachmentId: string, patch: OcrPatch) {
  if (isDatabaseConfigured()) {
    try {
      const existing = await prisma.shipmentAttachment.findFirst({
        where: { id: attachmentId, shipmentId },
      });
      if (!existing) return null;
      const updated = await prisma.shipmentAttachment.update({
        data: {
          ocrConfidence: patch.ocrConfidence ?? null,
          ocrStatus: patch.ocrStatus,
          ocrText: patch.ocrText ?? null,
        },
        where: { id: attachmentId },
      });
      return { data: mapPrismaAttachment(updated), source: "database" as const };
    } catch (error) {
      if (!isPrismaUnavailable(error)) throw error;
    }
  }

  const records = await readIndex();
  const index = records.findIndex((record) => record.id === attachmentId && record.shipmentId === shipmentId);
  if (index < 0) return null;
  const next = {
    ...records[index],
    ocrConfidence: patch.ocrConfidence ?? null,
    ocrStatus: patch.ocrStatus,
    ocrText: patch.ocrText ?? null,
    updatedAt: new Date().toISOString(),
  };
  records[index] = next;
  await writeIndex(records);
  return { data: next, source: "local" as const };
}

export async function ensureStoredFileExists(record: ShipmentAttachmentRecord) {
  const filePath = resolveAttachmentPath(record);
  const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
  if (!fileStat.isFile()) throw new Error("Stored attachment is not a file.");
  return filePath;
}
