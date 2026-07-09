import type { Prisma, SoOcrStatus } from "@prisma/client";

import { shipmentInclude, toShipmentRecord, type ShipmentWithRelations } from "@/lib/freightflow-data";
import { shipments } from "@/lib/mock-data";

import { AUTO_APPLY_CONFIDENCE, needsReview } from "./so-confidence";
import { extractSoFields } from "./so-extractor";
import type { SoDocumentCenterRecord, SoExtractedField, SoExtractionResult, SoFieldKey } from "./so-types";

type StoredExtractedField = {
  confidence: number | null;
  fieldKey: string;
  fieldValue: string | null;
  sourceText: string | null;
};

export const soDocumentCenterInclude = {
  extractedFields: { orderBy: { createdAt: "asc" as const } },
  shipment: { include: shipmentInclude },
} satisfies Prisma.SoDocumentInclude;

export type SoDocumentWithCenterRelations = Prisma.SoDocumentGetPayload<{ include: typeof soDocumentCenterInclude }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFieldKey(value: string): SoFieldKey | null {
  return [
    "soNo",
    "carrier",
    "vessel",
    "voyage",
    "etd",
    "eta",
    "portOfLoading",
    "portOfDischarge",
    "placeOfReceipt",
    "placeOfDelivery",
    "containerType",
    "containerQuantity",
    "cutoffTime",
    "cyClosing",
    "siCutoff",
    "amsCutoff",
    "aciCutoff",
    "isfCutoff",
    "pickupLocation",
    "returnLocation",
    "bookingAgent",
    "remarks",
  ].includes(value)
    ? (value as SoFieldKey)
    : null;
}

function normalizeConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  return Math.min(Math.max(numeric, 0), 1);
}

function fieldFromStored(row: StoredExtractedField): SoExtractedField | null {
  const fieldKey = normalizeFieldKey(row.fieldKey);
  if (!fieldKey) return null;

  const confidence = normalizeConfidence(row.confidence);

  return {
    confidence,
    fieldKey,
    needsReview: Boolean(row.fieldValue) && needsReview(confidence),
    sourceText: row.sourceText ?? "",
    value: row.fieldValue,
  };
}

function fieldFromJson(value: unknown): SoExtractedField | null {
  if (!isRecord(value) || typeof value.fieldKey !== "string") return null;

  const fieldKey = normalizeFieldKey(value.fieldKey);
  if (!fieldKey) return null;

  const confidence = normalizeConfidence(value.confidence);
  const fieldValue = typeof value.value === "string" ? value.value : null;

  return {
    confidence,
    fieldKey,
    needsReview: typeof value.needsReview === "boolean" ? value.needsReview : Boolean(fieldValue) && needsReview(confidence),
    sourceText: typeof value.sourceText === "string" ? value.sourceText : "",
    value: fieldValue,
  };
}

function extractionFromJson(value: unknown): SoExtractionResult | null {
  if (!isRecord(value) || !Array.isArray(value.fields)) return null;

  const fields = value.fields.map(fieldFromJson).filter((field): field is SoExtractedField => Boolean(field));
  const rawText = typeof value.rawText === "string" ? value.rawText : "";
  const confidence = normalizeConfidence(value.confidence);
  const status = value.status === "EXTRACTED" || value.status === "NEED_REVIEW" ? value.status : "NEED_REVIEW";

  return { confidence, fields, rawText, status };
}

function appliedAtFromJson(value: unknown) {
  if (!isRecord(value)) return null;

  const appliedAt = value.appliedAt;
  return typeof appliedAt === "string" && appliedAt.trim() ? appliedAt : null;
}

function appliedFieldsFromJson(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.appliedFields)) return [];

  return value.appliedFields.filter((field): field is string => typeof field === "string");
}

function failedReasonFromJson(value: unknown) {
  if (!isRecord(value)) return null;

  const error = value.error ?? value.failedReason;
  return typeof error === "string" && error.trim() ? error : null;
}

export function getSoDocumentBucket(input: {
  extractedJson?: unknown;
  ocrStatus: SoOcrStatus | string;
  status?: string;
}): Pick<SoDocumentCenterRecord, "statusBucket" | "statusLabel"> {
  if (input.status === "APPLIED") return { statusBucket: "applied", statusLabel: "已回写" };
  if (input.status === "FAILED") return { statusBucket: "failed", statusLabel: "失败" };
  if (input.ocrStatus === "FAILED") return { statusBucket: "failed", statusLabel: "失败" };
  if (appliedAtFromJson(input.extractedJson)) return { statusBucket: "applied", statusLabel: "已回写" };
  if (input.ocrStatus === "NEED_REVIEW" || input.ocrStatus === "EXTRACTED") {
    return { statusBucket: "review", statusLabel: "待复核" };
  }

  return { statusBucket: "pending", statusLabel: "待识别" };
}

export function extractionFromStoredDocument(document: {
  extractedFields?: StoredExtractedField[];
  extractedJson?: unknown;
  rawText?: string | null;
}): SoExtractionResult | null {
  const fromJson = extractionFromJson(document.extractedJson);
  if (fromJson) return fromJson;

  const fields =
    document.extractedFields?.map(fieldFromStored).filter((field): field is SoExtractedField => Boolean(field)) ?? [];

  if (fields.length === 0) return null;

  const foundConfidences = fields.filter((field) => field.value).map((field) => field.confidence);
  const confidence =
    foundConfidences.length === 0
      ? 0
      : foundConfidences.reduce((sum, value) => sum + value, 0) / foundConfidences.length;

  return {
    confidence,
    fields,
    rawText: document.rawText ?? "",
    status: fields.some((field) => field.value && field.needsReview) ? "NEED_REVIEW" : "EXTRACTED",
  };
}

export function toSoDocumentCenterRecord(document: SoDocumentWithCenterRelations): SoDocumentCenterRecord {
  const extraction = extractionFromStoredDocument(document);
  const bucket = getSoDocumentBucket({
    extractedJson: document.extractedJson,
    ocrStatus: document.ocrStatus,
    status: document.status,
  });
  const extractedFields = extraction?.fields ?? [];
  const reviewFields = extractedFields.filter((field) => field.value && field.confidence < AUTO_APPLY_CONFIDENCE);
  const shipment = document.shipment ? toShipmentRecord(document.shipment as ShipmentWithRelations) : null;

  return {
    ...bucket,
    appliedAt: appliedAtFromJson(document.extractedJson),
    appliedFields: appliedFieldsFromJson(document.extractedJson),
    batchNo: shipment?.batchNo ?? null,
    confidence: document.confidence ?? extraction?.confidence ?? null,
    createdAt: document.createdAt.toISOString(),
    extractedFields,
    failedReason: failedReasonFromJson(document.extractedJson),
    fileName: document.fileName,
    id: document.id,
    mimeType: document.mimeType,
    ocrStatus: document.ocrStatus,
    rawText: document.rawText,
    reviewFields,
    shipment,
    shipmentId: document.shipmentId,
    source: document.source,
    updatedAt: document.updatedAt.toISOString(),
  };
}

export function buildMockSoDocumentCenterRecords(): SoDocumentCenterRecord[] {
  return shipments.slice(0, 4).map((shipment, index) => {
    const rawText = [
      `SO: ${shipment.soNo}`,
      `Carrier: ${shipment.carrier}`,
      `Vessel: ${shipment.vesselVoyage.replace(/\s+\S+$/, "")}`,
      `Voyage: ${shipment.vesselVoyage.match(/\S+$/)?.[0] ?? ""}`,
      `ETD: ${shipment.etd}`,
      `POL: ${shipment.originPort}`,
      `POD: ${shipment.destinationPort}`,
      `Container Type: ${shipment.containerType}`,
      `Pickup Location: ${shipment.pickupLocation}`,
      `Return Location: ${shipment.returnLocation}`,
      `Booking Agent: ${shipment.bookingAgent}`,
    ].join("\n");
    const extraction = extractSoFields(rawText);
    const now = new Date(Date.UTC(2026, 5, 10, 8 + index, 0, 0)).toISOString();
    const statusBucket = index === 0 ? "pending" : index === 1 ? "review" : index === 2 ? "applied" : "failed";
    const statusLabel =
      statusBucket === "pending" ? "待识别" : statusBucket === "review" ? "待复核" : statusBucket === "applied" ? "已回写" : "失败";

    return {
      appliedAt: statusBucket === "applied" ? now : null,
      appliedFields: statusBucket === "applied" ? ["soNo", "carrier", "vesselVoyage"] : [],
      batchNo: shipment.batchNo,
      confidence: statusBucket === "pending" ? null : extraction.confidence,
      createdAt: now,
      extractedFields: statusBucket === "pending" ? [] : extraction.fields,
      failedReason: statusBucket === "failed" ? "OCR provider returned no rawText/text field." : null,
      fileName: `${shipment.batchNo}-so.txt`,
      id: `mock-so-${index + 1}`,
      mimeType: "text/plain",
      ocrStatus:
        statusBucket === "pending"
          ? "PENDING"
          : statusBucket === "review"
            ? "NEED_REVIEW"
            : statusBucket === "applied"
              ? "EXTRACTED"
              : "FAILED",
      rawText: statusBucket === "pending" ? null : rawText,
      reviewFields:
        statusBucket === "review"
          ? extraction.fields.filter((field) => field.value && field.confidence < AUTO_APPLY_CONFIDENCE)
          : [],
      shipment,
      shipmentId: shipment.id,
      source: "UPLOAD",
      statusBucket,
      statusLabel,
      updatedAt: now,
    };
  });
}
